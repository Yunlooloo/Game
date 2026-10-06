"""Chromium integration smoke: real DOM/input/audio plus controlled combat fixtures.

This is not a physical iPhone, WebKit, or public WebRTC connectivity test.
The HTTP server binds loopback on an ephemeral port and is always cleaned up.
"""
import asyncio
import functools
import json
import os
import threading
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "test-results/browser"


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


async def smoke(url, report):
    from playwright.async_api import async_playwright

    def check(name, passed, detail=None):
        report["checks"].append({"name": name, "passed": bool(passed), "detail": detail})
        print(("PASS " if passed else "FAIL ") + name, flush=True)

    async with async_playwright() as playwright:
        launch = {"headless": True}
        executable = os.environ.get("RIFT_BROWSER_EXECUTABLE")
        if executable:
            launch["executable_path"] = executable
        browser = await playwright.chromium.launch(**launch)
        try:
            desktop = await browser.new_context(viewport={"width": 1366, "height": 768})
            page = await desktop.new_page()
            page.on("pageerror", lambda error: report["page_errors"].append(str(error)))
            response = await page.goto(url, wait_until="load", timeout=60000)
            await page.wait_for_function("window.game?.debug && game.tutorial?.lessons.length > 0")
            report["game_version"] = await page.evaluate("game.debug.version")
            report["browser"] = browser.version
            check("Built game boots over HTTP", response.status == 200)
            check("Canvas lobby portrait rendered", await page.evaluate("""() => {
              const c = document.getElementById('lobby-art');
              return c.width > 200 && c.height > 200 && c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i) => i%4 === 3 && v > 0);
            }"""))
            await page.locator("#sound-button").click()
            await page.wait_for_function("game.audio.getMusicStatus().tracks.ambient?.seconds > .2", timeout=15000)
            check("First sound gesture enables rather than mutes audio", await page.evaluate("game.audio.getMusicStatus().unlocked && !game.audio.muted"))
            check("Embedded menu music advances without media error", await page.evaluate("!game.audio.getMusicStatus().tracks.ambient.error"))
            # Output samples establish a non-silent Web Audio graph, not hardware output.
            await page.evaluate("window.testAnalyser = game.audio.context.createAnalyser(); game.audio.ceiling.connect(testAnalyser)")
            await page.wait_for_timeout(250)
            check("Audio graph produces nonzero samples", await page.evaluate("() => {const a = new Float32Array(testAnalyser.fftSize);testAnalyser.getFloatTimeDomainData(a);return a.some(v => Math.abs(v) > .00001)}"))
            await page.locator("#start-ai").click()
            await page.wait_for_function("game.world.tick > 10")
            check("Boss mode advances the fixed simulation", await page.evaluate("game.mode === 'ai' && game.world.players[1].aiControlled && game.world.phase === 'fighting'"))
            check("Boss HUD presents three cores and a larger health capacity", await page.evaluate("""() => {
              game.renderHUD();
              const p=game.world.players[0], b=game.world.players[1], nodes=document.getElementById('nodes-1');
              return p.maxHp===100 && p.nodes===2 && b.maxHp===240 && b.maxPosture===220 && b.nodes===3 &&
                nodes.dataset.remaining==='3' && nodes.getAttribute('aria-label').includes('3/3') &&
                nodes.children.length===3 && nodes.querySelectorAll('.spent').length===0 &&
                document.getElementById('hp-1').style.width==='100%';
            }"""))
            # Separate the actors for input tests; AI still runs on production code.
            await page.evaluate("game.debug.setPlayers({x:1600,y:1080,ground:true},{x:3000,y:1080,ground:true});game.world.weather='dusk'")
            x = await page.evaluate("game.world.players[0].x")
            await page.keyboard.down("KeyD")
            await page.wait_for_timeout(300)
            await page.keyboard.up("KeyD")
            check("Real keyboard moves the player", await page.evaluate("game.world.players[0].x") > x + 30)
            await page.locator("#arena").click(position={"x": 800, "y": 420})
            await page.wait_for_function("game.world.players[0].moveName === 'light'", timeout=3000)
            check("Real left mouse starts a light attack", True)
            await page.wait_for_function("game.audio.getMusicStatus().tracks.battle?.playing", timeout=10000)
            check("Battle switches music scene", await page.evaluate("game.audio.getMusicStatus().scene === 'battle'"))
            await page.keyboard.press("Escape")
            tick = await page.evaluate("game.world.tick")
            await page.wait_for_timeout(150)
            check("Pause freezes simulation and suspends sound", await page.evaluate("game.paused && game.audio.suspended && game.world.tick") == tick)
            await page.locator("#resume").click()
            await page.wait_for_function(f"!game.paused && game.world.tick > {tick}")
            check("Resume continues the match", True)

            await page.evaluate("""() => {
              game.start('ai'); game.paused=true; game.world.weather='dusk';
              game.debug.setPlayers({x:1800,y:1080,ground:true,facing:1},{x:1950,y:1080,ground:true,facing:-1});
              game.begin(game.world.players[1],'rift');game.debug.step(0,0,44);
              game.renderer.render(game.world,0);game.renderHUD();
            }""")
            await page.screenshot(path=str(OUT / "rift-cue.png"))
            check("Rendered purple cue precedes an actual successful parry", await page.evaluate("""() => {
              const boss=game.world.players[1],cue=game.renderer.attackBeat(boss);
              if(cue.until!==8)return false;
              game.debug.step(game.debug.bits.GUARD,0,1);game.debug.step(0,0,7);
              return game.stats.deflects===1 && game.world.players[0].hp===100 && boss.state==='ACTIVE';
            }"""))

            # Fixture injection is explicit: health is lowered using production hit(),
            # then a normal attack input must consume each core through the real FSM.
            first = await page.evaluate("""() => {
              game.start('ai'); game.paused = true; game.world.weather = 'dusk';
              game.debug.setPlayers({x:1800,y:1080,ground:true,facing:1},{x:1880,y:1080,ground:true,facing:-1,hp:1});
              game.debug.hit(0,1,'light'); game.world.effects.hitstop = 0;
              const down = game.world.players[1].state === 'STUNNED';
              game.debug.step(game.debug.bits.ATTACK,0,1);
              const b = game.world.players[1];
              return {down,nodes:b.nodes,hp:b.hp,posture:b.posture,phase:b.phase,state:b.state,round:game.world.phase};
            }""")
            check("Zero HP exposes a finisher without automatic death", first["down"], first)
            check("First finisher restores the boss in phase two with two cores", first["nodes"] == 2 and first["hp"] == 240 and first["posture"] == 0 and first["phase"] == 2 and first["state"] == "REVIVING" and first["round"] == "fighting", first)
            second = await page.evaluate("""() => {
              game.world.effects.hitstop = 0; game.debug.step(0,0,90);
              game.debug.setPlayers({x:1800,y:1080,ground:true,facing:1},{x:1880,y:1080,ground:true,facing:-1,hp:1});
              game.debug.hit(0,1,'light'); game.world.effects.hitstop = 0;
              game.debug.step(game.debug.bits.ATTACK,0,1);
              const b = game.world.players[1];
              return {nodes:b.nodes,hp:b.hp,posture:b.posture,phase:b.phase,state:b.state,round:game.world.phase};
            }""")
            check("Second finisher starts phase three instead of ending the fight", second["nodes"] == 1 and second["hp"] == 240 and second["posture"] == 0 and second["phase"] == 3 and second["state"] == "REVIVING" and second["round"] == "fighting", second)
            third = await page.evaluate("""() => {
              game.world.effects.hitstop = 0; game.debug.step(0,0,90);
              game.debug.setPlayers({x:1800,y:1080,ground:true,facing:1},{x:1880,y:1080,ground:true,facing:-1,hp:1});
              game.debug.hit(0,1,'light'); game.world.effects.hitstop = 0;
              game.debug.step(game.debug.bits.ATTACK,0,1);
              game.showResult();
              return {nodes:game.world.players[1].nodes,phase:game.world.phase,winner:game.world.winner,visible:!document.getElementById('result').hidden};
            }""")
            check("Third finisher ends the match and shows victory", third["nodes"] == 0 and third["phase"] == "ended" and third["winner"] == 0 and third["visible"], third)
            await page.locator("#retry").click()
            check("Result restart restores the player's two cores and Boss's three cores", await page.evaluate("game.mode === 'ai' && game.world.phase === 'fighting' && game.world.players[0].nodes === 2 && game.world.players[0].hp === 100 && game.world.players[1].nodes === 3 && game.world.players[1].hp === 240 && game.world.players[1].phase === 1"))
            await page.wait_for_timeout(400)  # Let the core-opacity restart transition settle.
            await page.screenshot(path=str(OUT / "desktop.png"))
            await desktop.close()

            mobile = await browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
            page = await mobile.new_page()
            page.on("pageerror", lambda error: report["page_errors"].append(str(error)))
            await page.goto(url, wait_until="load")
            check("Mobile lobby has no horizontal overflow", await page.evaluate("document.documentElement.scrollWidth <= innerWidth+1"))
            await page.locator("#start-local").tap()
            await page.evaluate("game.debug.setPlayers({x:1600,y:1080,ground:true},{x:3000,y:1080,ground:true});game.world.weather='dusk'")
            await page.wait_for_function("game.audio.getMusicStatus().unlocked", timeout=10000)
            check("A real touch gesture unlocks audio", True)
            cdp = await mobile.new_cdp_session(page)

            async def point(code, identifier):
                rect = await page.locator(f'[data-touch="{code}"]').bounding_box()
                return {"x": rect["x"] + rect["width"] / 2, "y": rect["y"] + rect["height"] / 2, "id": identifier, "radiusX": 10, "radiusY": 10, "force": 1}

            left, guard = await point("KeyA", 1), await point("KeyK", 2)
            dimensions = await page.evaluate("Array.from(document.querySelectorAll('[data-touch=KeyA],[data-touch=KeyD]')).map(e=>{const r=e.getBoundingClientRect();return [r.width,r.height]})")
            check("Movement targets are at least 64 CSS pixels", all(w >= 64 and h >= 64 for w, h in dimensions), dimensions)
            x = await page.evaluate("game.world.players[0].x")
            await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [left]})
            await page.wait_for_timeout(750)
            check("Long touch moves continuously without selecting the page", await page.evaluate("game.world.players[0].x") < x - 100 and await page.evaluate("String(getSelection()) === '' && game.touchHeld.size === 1"))
            await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [left, guard]})
            await page.wait_for_timeout(250)
            check("Two fingers independently hold movement and guard", await page.evaluate("game.touchHeld.size === 2 && game.world.players[0].guard"))
            await cdp.send("Input.dispatchTouchEvent", {"type": "touchCancel", "touchPoints": []})
            check("Touch cancellation clears held input and feedback", await page.evaluate("game.touchHeld.size === 0 && game.touchTargets.size === 0 && !document.querySelector('.is-held')"))
            check("Selection and context menu defaults are blocked on controls", await page.evaluate("""() => ['selectstart','contextmenu'].every(type=>{
              const e = new Event(type,{bubbles:true,cancelable:true});
              document.querySelector('[data-touch=KeyA]').dispatchEvent(e);return e.defaultPrevented;
            })"""))
            await page.locator("#touch-pause").tap()
            check("Mobile pause button opens the menu", await page.evaluate("game.paused && !document.getElementById('pause-panel').hidden"))
            await page.locator("#resume").tap()
            check("Mobile resume clears pause", await page.evaluate("!game.paused && !game.audio.suspended"))
            await page.screenshot(path=str(OUT / "mobile.png"))
            await page.evaluate("game.lobby();document.getElementById('network-panel').hidden=false")
            await page.locator("#room-code").fill("TEST123")
            check("Room field remains editable and selectable", await page.locator("#room-code").evaluate("el=>{el.select();return el.selectionEnd-el.selectionStart===7 && getComputedStyle(el).userSelect!=='none'}"))
            await mobile.close()
            check("No browser JavaScript exceptions", not report["page_errors"], report["page_errors"])
        except Exception as error:
            report["runner_error"] = str(error)
            print("FAIL browser runner: " + str(error), flush=True)
        finally:
            await browser.close()
def main():
    OUT.mkdir(parents=True, exist_ok=True)
    report = {"scope": "Real Chromium; seeded combat fixtures; no iPhone/WebKit/WebRTC claim",
              "started_at": datetime.now(timezone.utc).isoformat(), "status": "running",
              "checks": [], "page_errors": []}
    report_file = OUT / "report.json"
    # Invalidate evidence from a previous successful run before any imports,
    # socket binding or browser launch can fail.
    report_file.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    for name in ("desktop.png", "mobile.png", "rift-cue.png"):
        (OUT / name).unlink(missing_ok=True)
    server = thread = None
    try:
        server = ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT)))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        asyncio.run(smoke(f"http://127.0.0.1:{server.server_port}/", report))
    except Exception as error:
        report["runner_error"] = str(error)
        print("FAIL browser startup or runner: " + str(error), flush=True)
    finally:
        if server:
            if thread and thread.is_alive():
                server.shutdown()
            server.server_close()
        if thread and thread.is_alive():
            thread.join(timeout=5)
    report["passed"] = sum(row["passed"] for row in report["checks"])
    report["failed"] = sum(not row["passed"] for row in report["checks"]) + bool(report.get("runner_error"))
    if not report["checks"] and not report["failed"]:
        report["runner_error"] = "No browser checks executed"
        report["failed"] = 1
    report["status"] = "failed" if report["failed"] else "passed"
    report["finished_at"] = datetime.now(timezone.utc).isoformat()
    report_file.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Browser smoke: {report['passed']} passed, {report['failed']} failed.")
    return 1 if report["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
