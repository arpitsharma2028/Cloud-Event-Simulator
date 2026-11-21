import subprocess
import time
import sys
import os
import urllib.request
from playwright.sync_api import sync_playwright

def main():
    os.makedirs("Report/screenshots", exist_ok=True)
    log_file = open("backend.log", "w", encoding="utf-8")
    
    print("Starting backend server redirecting to backend.log...", flush=True)
    proc = subprocess.Popen(
        ["node", "backend/src/index.js"],
        cwd=os.getcwd(),
        stdout=log_file,
        stderr=subprocess.STDOUT
    )

    try:
        health_ok = False
        start = time.time()
        while time.time() - start < 15:
            if proc.poll() is not None:
                print("Server exited prematurely! Check backend.log", flush=True)
                break
            try:
                req = urllib.request.Request("http://127.0.0.1:3000/health", headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=1) as response:
                    if response.status == 200:
                        print("Server is healthy at http://127.0.0.1:3000/health!", flush=True)
                        health_ok = True
                        break
            except Exception:
                pass
            time.sleep(0.5)

        if not health_ok:
            print("Server failed to respond to health check.", flush=True)
            sys.exit(1)

        with sync_playwright() as p:
            print("Launching headless Chromium...", flush=True)
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                viewport={"width": 1440, "height": 900},
                color_scheme="dark"
            )
            page = context.new_page()

            print("Navigating to http://127.0.0.1:3000...", flush=True)
            page.goto("http://127.0.0.1:3000", wait_until="networkidle")
            page.wait_for_timeout(1500)

            # -------------------------------------------------------------------------
            # 1. Workload Studio
            # -------------------------------------------------------------------------
            print("Navigating to Workload Studio...", flush=True)
            page.click("header button:has-text('Workload Studio'), button:has-text('Workload Studio')")
            page.wait_for_timeout(1500)

            print("Selecting preset full_lifecycle...", flush=True)
            page.evaluate("""() => {
                const selects = Array.from(document.querySelectorAll('select'));
                for (const s of selects) {
                    const opt = s.querySelector("option[value='full_lifecycle']");
                    if (opt) {
                        s.value = 'full_lifecycle';
                        s.dispatchEvent(new Event('change', { bubbles: true }));
                        break;
                    }
                }
            }""")
            page.wait_for_timeout(1500)

            page.screenshot(path="Report/screenshots/01_workload_studio.png", full_page=False)
            print("Saved Report/screenshots/01_workload_studio.png", flush=True)

            # -------------------------------------------------------------------------
            # Run Simulation
            # -------------------------------------------------------------------------
            print("Running simulation...", flush=True)
            page.click("button[type='submit']")
            # Wait for simulation to finish and navigate to console
            page.wait_for_timeout(4000)

            # -------------------------------------------------------------------------
            # 2. Simulation Console mid-run (T ≈ 35s - 40s)
            # -------------------------------------------------------------------------
            print("Configuring Simulation Console mid-run snapshot...", flush=True)
            page.wait_for_selector("input[type='range']", timeout=10000)

            # Set range scrubber to snapshot around index 74 (T ≈ 37s)
            page.evaluate("""() => {
                const slider = document.querySelector("input[type='range']");
                if (slider) {
                    const max = parseInt(slider.max || "120", 10);
                    slider.value = Math.min(max, 74);
                    slider.dispatchEvent(new Event('input', { bubbles: true }));
                    slider.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }""")
            page.wait_for_timeout(2000)

            page.screenshot(path="Report/screenshots/02_simulation_console.png", full_page=False)
            print("Saved Report/screenshots/02_simulation_console.png", flush=True)

            # -------------------------------------------------------------------------
            # 3. Results & Analytics
            # -------------------------------------------------------------------------
            print("Navigating to Results & Analytics...", flush=True)
            page.click("header button:has-text('Results & Analytics'), button:has-text('Results & Analytics')")
            page.wait_for_timeout(2000)
            page.screenshot(path="Report/screenshots/03_results_analytics.png", full_page=False)
            print("Saved Report/screenshots/03_results_analytics.png", flush=True)

            # -------------------------------------------------------------------------
            # 4. Comparison Studio (Benchmark run)
            # -------------------------------------------------------------------------
            print("Navigating to Comparison Studio...", flush=True)
            page.click("header button:has-text('Comparison Studio'), button:has-text('Comparison Studio')")
            page.wait_for_timeout(1500)

            # Run policy experiment benchmark
            print("Triggering benchmark experiment...", flush=True)
            page.click("button:has-text('Execute Policy Experiment')")
            # Wait for ranking cards / table
            page.wait_for_timeout(5000)

            page.screenshot(path="Report/screenshots/04_comparison_studio.png", full_page=False)
            print("Saved Report/screenshots/04_comparison_studio.png", flush=True)

            browser.close()
            print("SUCCESS: All 4 screenshots captured successfully!", flush=True)
    finally:
        print("Stopping backend server...", flush=True)
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except Exception:
            proc.kill()
        log_file.close()

if __name__ == "__main__":
    main()
