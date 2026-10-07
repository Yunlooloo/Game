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
            # Render through the actual ceiling curve in Web Audio, not a mock
            # interpolation: ordinary music must survive without new harmonics.
            ceiling = await page.evaluate("""async () => {
              async function render(amplitude) {
                const c=new OfflineAudioContext(1,4096,48000), b=c.createBuffer(1,4096,48000);
                const input=b.getChannelData(0);
                for(let i=0;i<input.length;i++)input[i]=amplitude*Math.sin(i*2*Math.PI*440/48000);
                const source=c.createBufferSource(), shaper=c.createWaveShaper();
                source.buffer=b; shaper.curve=game.audio.ceiling.curve;
                source.connect(shaper);shaper.connect(c.destination);source.start();
                const output=(await c.startRendering()).getChannelData(0);
                return {error:Math.max(...output.map((v,i)=>Math.abs(v-input[i]))),peak:Math.max(...output.map(Math.abs))};
              }
              return {normal:await render(.5),overload:await render(2)};
            }""")
            check("Real WaveShaper preserves normal music and bounds overloaded peaks", ceiling["normal"]["error"] < 0.000001 and 0.9 < ceiling["overload"]["peak"] < 0.93, ceiling)
            await page.evaluate("game.audio.setMusicVolume(0)")
            await page.wait_for_timeout(1100)
            quiet = await page.evaluate("""() => {
              const a=new Float32Array(testAnalyser.fftSize);testAnalyser.getFloatTimeDomainData(a);
              return {peak:Math.max(...a.map(Math.abs)),layers:[game.audio.wind,game.audio.rain,game.audio.river].map(n=>n.level.gain.value)};
            }""")
            check("Music slider zero leaves no substitute ambience hiss in real output", quiet["peak"] < 0.000001 and all(abs(g) < 0.000001 for g in quiet["layers"]), quiet)
            await page.evaluate("game.audio.setMusicVolume(.3)")
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

            async def check_mobile_layout(page, orientation):
                layout = await page.evaluate("""() => {
                  const rect = el => {const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}};
                  const left=[...document.querySelectorAll('.touch-movement [data-touch]')];
                  const right=[...document.querySelectorAll('.touch-combat [data-touch]')];
                  const main=[...left,...right], menu=document.getElementById('combat-menu');
                  const codes=els=>els.map(e=>e.dataset.touch).sort().join(',');
                  const jump=rect(document.querySelector('[data-touch="Space"]'));
                  const moveLeft=rect(document.querySelector('[data-touch="KeyA"]'));
                  const moveRight=rect(document.querySelector('[data-touch="KeyD"]'));
                  return {sizes:main.map(rect), grouped:codes(left)==='KeyA,KeyD,Space' && codes(right)==='KeyJ,KeyK,KeyL' &&
                    left.every(e=>rect(e).x+rect(e).w<=innerWidth/2) && right.every(e=>rect(e).x>=innerWidth/2),
                    jumpAbove:jump.y+jump.h<=Math.min(moveLeft.y,moveRight.y) &&
                      Math.abs(jump.x+jump.w/2-(moveLeft.x+moveRight.x+moveRight.w)/2)<1,
                    closed:!document.querySelector('.touch-utilities').open,
                    menu:!!menu && !menu.closest('#touch-controls') && rect(menu).w>=44 && rect(menu).h>=44 &&
                      rect(menu).y+rect(menu).h<=rect(document.getElementById('combat-caption')).y};
                }""")
                check(f"{orientation}: jump sits above both movement keys and six primary targets stay at least 64 px",
                      layout["grouped"] and layout["jumpAbove"] and len(layout["sizes"]) == 6 and all(r["w"] >= 64 and r["h"] >= 64 for r in layout["sizes"]), layout)
                check(f"{orientation}: utilities start collapsed and menu stays outside thumb controls", layout["closed"] and layout["menu"], layout)
                await page.locator(".touch-utilities summary").tap()
                drawer = await page.evaluate("""() => {
                  const elements=[...document.querySelectorAll('.touch-controls button,.touch-utilities summary,#combat-menu')];
                  const boxes=elements.map(el=>{const r=el.getBoundingClientRect();return {el,r}});
                  const fits=boxes.every(({el,r})=>r.width>=44 && r.height>=44 && r.left>=0 && r.top>=0 &&
                    r.right<=innerWidth && r.bottom<=innerHeight && document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el);
                  const separated=boxes.every((a,i)=>boxes.slice(i+1).every(b=>a.r.right<=b.r.left || b.r.right<=a.r.left || a.r.bottom<=b.r.top || b.r.bottom<=a.r.top));
                  const utilities=[...document.querySelectorAll('.touch-utility-actions [data-touch]')].map(e=>e.dataset.touch).sort();
                  return {open:document.querySelector('.touch-utilities').open,fits,separated,utilities,
                    boxes:boxes.map(({el,r})=>({key:el.dataset.touch || el.id || el.tagName,x:r.x,y:r.y,w:r.width,h:r.height}))};
                }""")
                check(f"{orientation}: utility drawer exposes every ability without overlap or offscreen targets",
                      drawer["open"] and drawer["fits"] and drawer["separated"] and drawer["utilities"] == ["KeyE", "KeyF", "KeyO", "KeyQ", "KeyR"], drawer)
                await page.screenshot(path=str(OUT / f"mobile-{orientation.lower().replace(' ', '-')}-utilities.png"))
                slot = await page.evaluate("game.activeToolSlot")
                await page.locator('[data-touch="KeyQ"]').tap()
                check(f"{orientation}: expanded tool switch still uses the existing input binding", await page.evaluate("game.activeToolSlot") != slot)
                await page.locator(".touch-utilities summary").tap()
                check(f"{orientation}: utility drawer closes without pausing combat", await page.evaluate("!document.querySelector('.touch-utilities').open && !game.paused"))

            mobile = await browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
            page = await mobile.new_page()
            page.on("pageerror", lambda error: report["page_errors"].append(str(error)))
            await page.goto(url, wait_until="load")
            check("Mobile lobby has no horizontal overflow", await page.evaluate("document.documentElement.scrollWidth <= innerWidth+1"))
            await page.locator("#start-local").tap()
            await page.evaluate("game.debug.setPlayers({x:1600,y:1080,ground:true},{x:3000,y:1080,ground:true});game.world.weather='dusk'")
            await page.wait_for_function("game.audio.getMusicStatus().unlocked", timeout=10000)
            check("A real touch gesture unlocks audio", True)
            await check_mobile_layout(page, "Portrait")
            cdp = await mobile.new_cdp_session(page)

            async def point(code, identifier):
                rect = await page.locator(f'[data-touch="{code}"]').bounding_box()
                return {"x": rect["x"] + rect["width"] / 2, "y": rect["y"] + rect["height"] / 2, "id": identifier, "radiusX": 10, "radiusY": 10, "force": 1}

            left, guard = await point("KeyA", 1), await point("KeyK", 2)
            x = await page.evaluate("game.world.players[0].x")
            await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [left]})
            await page.wait_for_timeout(750)
            check("Long touch moves continuously without selecting the page", await page.evaluate("game.world.players[0].x") < x - 100 and await page.evaluate("String(getSelection()) === '' && game.touchHeld.size === 1"))
            await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [left, guard]})
            await page.wait_for_timeout(250)
            check("Two fingers independently hold movement and guard", await page.evaluate("game.touchHeld.size === 2 && game.world.players[0].guard"))
            await cdp.send("Input.dispatchTouchEvent", {"type": "touchCancel", "touchPoints": []})
            check("Touch cancellation clears held input and feedback", await page.evaluate("game.touchHeld.size === 0 && game.touchTargets.size === 0 && !document.querySelector('.is-held')"))
            await page.wait_for_timeout(100)
            right, jump = await point("KeyD", 3), await point("Space", 4)
            x = await page.evaluate("game.world.players[0].x")
            await cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [right, jump]})
            await page.wait_for_timeout(150)
            movement_jump = await page.evaluate("({held:game.touchHeld.size,airborne:!game.world.players[0].ground,x:game.world.players[0].x})")
            check("Movement and the relocated jump work together", movement_jump["held"] == 2 and movement_jump["airborne"] and movement_jump["x"] > x + 10, movement_jump)
            await cdp.send("Input.dispatchTouchEvent", {"type": "touchCancel", "touchPoints": []})
            check("Selection and context menu defaults are blocked on controls", await page.evaluate("""() => ['selectstart','contextmenu'].every(type=>{
              const e = new Event(type,{bubbles:true,cancelable:true});
              document.querySelector('[data-touch=KeyA]').dispatchEvent(e);return e.defaultPrevented;
            })"""))
            await page.locator("#combat-menu").tap()
            check("Mobile HUD menu opens pause and sound settings", await page.evaluate("game.paused && !document.getElementById('pause-panel').hidden"))
            await page.locator("#resume").tap()
            check("Mobile resume clears pause", await page.evaluate("!game.paused && !game.audio.suspended"))
            await page.screenshot(path=str(OUT / "mobile.png"))
            await page.evaluate("game.lobby();document.getElementById('network-panel').hidden=false")
            await page.locator("#room-code").fill("TEST123")
            check("Room field remains editable and selectable", await page.locator("#room-code").evaluate("el=>{el.select();return el.selectionEnd-el.selectionStart===7 && getComputedStyle(el).userSelect!=='none'}"))
            await mobile.close()
            landscape = await browser.new_context(viewport={"width": 844, "height": 390}, has_touch=True, is_mobile=True)
            page = await landscape.new_page()
            page.on("pageerror", lambda error: report["page_errors"].append(str(error)))
            await page.goto(url, wait_until="load")
            await page.locator("#start-local").tap()
            await check_mobile_layout(page, "Landscape")
            await page.screenshot(path=str(OUT / "mobile-landscape.png"))
            await landscape.close()
            for orientation, width, height in (("Narrow portrait", 320, 568), ("Compact landscape", 568, 320)):
                compact = await browser.new_context(viewport={"width": width, "height": height}, has_touch=True, is_mobile=True)
                page = await compact.new_page()
                page.on("pageerror", lambda error: report["page_errors"].append(str(error)))
                await page.goto(url, wait_until="load")
                await page.locator("#start-local").tap()
                await check_mobile_layout(page, orientation)
                await compact.close()
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
    for name in ("desktop.png", "mobile.png", "mobile-landscape.png", "mobile-portrait-utilities.png", "mobile-landscape-utilities.png",
                 "mobile-narrow-portrait-utilities.png", "mobile-compact-landscape-utilities.png", "rift-cue.png"):
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
