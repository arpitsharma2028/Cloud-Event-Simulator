import os
import pptx
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

def hex_to_rgb(hex_str):
    hex_str = hex_str.lstrip('#')
    return RGBColor(*(int(hex_str[i:i+2], 16) for i in (0, 2, 4)))

# Color Palette
BG_COLOR = hex_to_rgb("0F172A")        # Deep slate
CARD_BG = hex_to_rgb("1E293B")         # Dark slate surface
CARD_BORDER = hex_to_rgb("334155")     # Subtle border
TEXT_WHITE = hex_to_rgb("F8FAFC")      # Primary text
TEXT_MUTED = hex_to_rgb("94A3B8")      # Muted text
ACCENT_CYAN = hex_to_rgb("38BDF8")     # Primary accent (Cyan)
ACCENT_EMERALD = hex_to_rgb("10B981")  # Emerald accent
ACCENT_AMBER = hex_to_rgb("F59E0B")    # Amber accent
ACCENT_ROSE = hex_to_rgb("F43F5E")     # Rose accent

def add_run(paragraph, text, bold=False, color=None, size_pt=None):
    r = paragraph.add_run()
    r.text = text
    if bold:
        r.font.bold = True
    if color:
        r.font.color.rgb = color
    if size_pt:
        r.font.size = Pt(size_pt)
    r.font.name = "Arial"
    return r

def set_slide_background(slide):
    background = slide.background
    fill = background.fill
    fill.solid()
    fill.fore_color.rgb = BG_COLOR

def add_header(slide, title_text, category="CLOUD EVENT SIMULATOR"):
    # Category Pill / Tag
    tb_cat = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(8), Inches(0.3))
    tf_cat = tb_cat.text_frame
    tf_cat.word_wrap = True
    p_cat = tf_cat.paragraphs[0]
    add_run(p_cat, category.upper(), bold=True, color=ACCENT_CYAN, size_pt=10)

    # Main Title
    tb_title = slide.shapes.add_textbox(Inches(0.8), Inches(0.68), Inches(11.5), Inches(0.6))
    tf_title = tb_title.text_frame
    tf_title.word_wrap = True
    p_title = tf_title.paragraphs[0]
    add_run(p_title, title_text, bold=True, color=TEXT_WHITE, size_pt=22)

def add_card(slide, left, top, width, height, title="", title_color=ACCENT_CYAN, border_color=CARD_BORDER):
    shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = CARD_BG
    shape.line.color.rgb = border_color
    shape.line.width = Pt(1)
    
    if title:
        tb = slide.shapes.add_textbox(left + Inches(0.15), top + Inches(0.12), width - Inches(0.3), Inches(0.35))
        tf = tb.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        add_run(p, title, bold=True, color=title_color, size_pt=13)
    return shape

def build_presentation():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    blank_layout = prs.slide_layouts[6]

    # =========================================================================
    # SLIDE 1: TITLE SLIDE
    # =========================================================================
    s1 = prs.slides.add_slide(blank_layout)
    set_slide_background(s1)

    # Decorative Card in Center
    add_card(s1, Inches(1.2), Inches(1.2), Inches(10.933), Inches(5.1), border_color=ACCENT_CYAN)

    tb = s1.shapes.add_textbox(Inches(1.6), Inches(1.5), Inches(10.133), Inches(4.5))
    tf = tb.text_frame
    tf.word_wrap = True

    p0 = tf.paragraphs[0]
    p0.space_after = Pt(8)
    add_run(p0, "ACADEMIC & TECHNICAL CAPSTONE PROJECT", bold=True, color=ACCENT_CYAN, size_pt=11)

    p1 = tf.add_paragraph()
    p1.space_after = Pt(6)
    add_run(p1, "Cloud Event Simulator", bold=True, color=TEXT_WHITE, size_pt=36)

    p2 = tf.add_paragraph()
    p2.space_after = Pt(28)
    add_run(p2, "Deterministic Discrete-Event Cloud Infrastructure & Autoscaling Workbench", color=ACCENT_EMERALD, size_pt=16)

    p3 = tf.add_paragraph()
    p3.space_after = Pt(4)
    add_run(p3, "Author: Arpit Sharma", bold=True, color=TEXT_WHITE, size_pt=13)

    p4 = tf.add_paragraph()
    p4.space_after = Pt(4)
    add_run(p4, "Institution: Thapar Institute of Engineering and Technology, Patiala", color=TEXT_MUTED, size_pt=12)

    p5 = tf.add_paragraph()
    p5.space_after = Pt(4)
    add_run(p5, "Technology Stack: C++14 Simulation Core | Express.js API Bridge | React.js Observability Console", color=ACCENT_CYAN, size_pt=11)

    p6 = tf.add_paragraph()
    add_run(p6, "Release Date: November 2026 | Production Version v2.4.0", color=TEXT_MUTED, size_pt=10)

    # =========================================================================
    # SLIDE 2: PROBLEM STATEMENT & MOTIVATION
    # =========================================================================
    s2 = prs.slides.add_slide(blank_layout)
    set_slide_background(s2)
    add_header(s2, "The Live Cloud Dilemma: Cost, Latency & Nondeterminism", "PROBLEM STATEMENT & MOTIVATION")

    col_w = Inches(3.64)
    gap = Inches(0.4)
    top_pos = Inches(1.5)
    card_h = Inches(4.5)

    # Card 1: Live Cloud Pitfalls
    add_card(s2, Inches(0.8), top_pos, col_w, card_h, "1. Live Cloud Barriers", ACCENT_ROSE)
    tb = s2.shapes.add_textbox(Inches(0.95), top_pos + Inches(0.55), col_w - Inches(0.3), card_h - Inches(0.7))
    tf = tb.text_frame
    tf.word_wrap = True
    items1 = [
        ("Prohibitive Expense: ", "Running multi-node clusters with ALBs and CloudWatch metrics generates non-trivial recurring AWS bills."),
        ("Slow Feedback Loop: ", "VM spin-up (EC2 warmup) and autoscaling cooldowns require 5–15 minutes per experimental cycle."),
        ("Production Risk: ", "Injecting chaos/failure tests into staging carries outage risks.")
    ]
    for bold_txt, norm_txt in items1:
        p = tf.add_paragraph()
        p.space_after = Pt(10)
        add_run(p, bold_txt, bold=True, color=TEXT_WHITE, size_pt=10.5)
        add_run(p, norm_txt, color=TEXT_MUTED, size_pt=10)

    # Card 2: Nondeterminism
    add_card(s2, Inches(0.8) + col_w + gap, top_pos, col_w, card_h, "2. Nondeterminism Dilemma", ACCENT_AMBER)
    tb = s2.shapes.add_textbox(Inches(0.8) + col_w + gap + Inches(0.15), top_pos + Inches(0.55), col_w - Inches(0.3), card_h - Inches(0.7))
    tf = tb.text_frame
    tf.word_wrap = True
    items2 = [
        ("Noisy Neighbors: ", "Shared public cloud hypervisors introduce random latency spikes."),
        ("No Apples-to-Apples: ", "Network jitter makes comparing two routing algorithms scientifically invalid across distinct runs."),
        ("Unrepeatable Bugs: ", "Corner-case queue starvation and race conditions cannot be reliably reproduced.")
    ]
    for bold_txt, norm_txt in items2:
        p = tf.add_paragraph()
        p.space_after = Pt(10)
        add_run(p, bold_txt, bold=True, color=TEXT_WHITE, size_pt=10.5)
        add_run(p, norm_txt, color=TEXT_MUTED, size_pt=10)

    # Card 3: The Simulation Solution
    add_card(s2, Inches(0.8) + (col_w + gap) * 2, top_pos, col_w, card_h, "3. The DES Solution", ACCENT_EMERALD)
    tb = s2.shapes.add_textbox(Inches(0.8) + (col_w + gap) * 2 + Inches(0.15), top_pos + Inches(0.55), col_w - Inches(0.3), card_h - Inches(0.7))
    tf = tb.text_frame
    tf.word_wrap = True
    items3 = [
        ("Zero Cloud Cost: ", "Runs entirely on local compute in sub-millisecond execution time with zero cloud provider charges."),
        ("Bit-Exact Determinism: ", "Identical PRNG seeds yield mathematically identical traces, perfect for rigorous comparative benchmarks."),
        ("Time-Warp Replay: ", "Simulate 80 seconds of intensive cloud traffic in 1 ms; inspect cluster states at any microsecond.")
    ]
    for bold_txt, norm_txt in items3:
        p = tf.add_paragraph()
        p.space_after = Pt(10)
        add_run(p, bold_txt, bold=True, color=TEXT_WHITE, size_pt=10.5)
        add_run(p, norm_txt, color=TEXT_MUTED, size_pt=10)

    # Bottom Banner
    add_card(s2, Inches(0.8), Inches(6.2), Inches(11.733), Inches(0.8), border_color=ACCENT_CYAN)
    tb_b = s2.shapes.add_textbox(Inches(0.95), Inches(6.25), Inches(11.4), Inches(0.7))
    tf_b = tb_b.text_frame
    p_b = tf_b.paragraphs[0]
    add_run(p_b, "CORE OBJECTIVE: Deliver an interactive, zero-cost cloud testbed bridging theoretical queueing theory with real AWS distributed systems architectures.", bold=True, color=ACCENT_CYAN, size_pt=10.5)

    # =========================================================================
    # SLIDE 3: TWO-TIER DECOUPLED ARCHITECTURE
    # =========================================================================
    s3 = prs.slides.add_slide(blank_layout)
    set_slide_background(s3)
    add_header(s3, "Two-Tier Decoupled Architecture: C++14 Engine + React Telemetry", "SYSTEM ARCHITECTURE")

    tier_w = Inches(3.64)
    tier_h = Inches(5.1)
    
    # Tier 1: C++ Simulation Engine
    add_card(s3, Inches(0.8), Inches(1.5), tier_w, tier_h, "Tier 1: C++14 DES Core", ACCENT_CYAN)
    tb = s3.shapes.add_textbox(Inches(0.95), Inches(2.1), tier_w - Inches(0.3), tier_h - Inches(0.8))
    tf = tb.text_frame
    tf.word_wrap = True
    items_t1 = [
        ("Execution Kernel: ", "Min-Heap priority queue advancing simulation clock exclusively on events."),
        ("Resource Accounting: ", "Real-time vCPU & RAM tracking per node; node queue bounds."),
        ("Performance: ", "0.35–1.15 ms execution for 300+ request traces; zero dynamic heap reallocations."),
        ("Output: ", "Generates structured JSON snapshots, scaling metrics, and decision trace logs.")
    ]
    for b_txt, n_txt in items_t1:
        p = tf.add_paragraph()
        p.space_after = Pt(8)
        add_run(p, b_txt, bold=True, color=TEXT_WHITE, size_pt=10)
        add_run(p, n_txt, color=TEXT_MUTED, size_pt=9.5)

    # Tier 2: Node.js API Bridge
    add_card(s3, Inches(0.8) + tier_w + gap, Inches(1.5), tier_w, tier_h, "Tier 2: Node / Express Bridge", ACCENT_EMERALD)
    tb = s3.shapes.add_textbox(Inches(0.8) + tier_w + gap + Inches(0.15), Inches(2.1), tier_w - Inches(0.3), tier_h - Inches(0.8))
    tf = tb.text_frame
    tf.word_wrap = True
    items_t2 = [
        ("Zod Validation: ", "Strict schema verification of duration, arrival rates, hardware profiles, and seeds."),
        ("Process Orchestrator: ", "Cross-platform executable resolution (Windows .exe / POSIX binary) with safe spawn."),
        ("Simulation Registry: ", "In-memory LRU store caching multi-policy benchmarks and telemetry snapshots."),
        ("REST & SSE APIs: ", "Endpoints for /api/simulations, /api/presets, and /api/compare.")
    ]
    for b_txt, n_txt in items_t2:
        p = tf.add_paragraph()
        p.space_after = Pt(8)
        add_run(p, b_txt, bold=True, color=TEXT_WHITE, size_pt=10)
        add_run(p, n_txt, color=TEXT_MUTED, size_pt=9.5)

    # Tier 3: React Observability Console
    add_card(s3, Inches(0.8) + (tier_w + gap) * 2, Inches(1.5), tier_w, tier_h, "Tier 3: React Observability UI", ACCENT_AMBER)
    tb = s3.shapes.add_textbox(Inches(0.8) + (tier_w + gap) * 2 + Inches(0.15), Inches(2.1), tier_w - Inches(0.3), tier_h - Inches(0.8))
    tf = tb.text_frame
    tf.word_wrap = True
    items_t3 = [
        ("Workload Studio: ", "Intuitive scenario builder with traffic spikes and node failure injection."),
        ("Simulation Console: ", "Bento-grid cockpit with node health cards, utilization charts, and live decision logs."),
        ("Timeline Scrubber: ", "Interactive T = 0.0s to 80.0s time-warp replay with playback speeds."),
        ("Comparison Studio: ", "Side-by-side multi-policy rankings, algorithmic grading (A/B/C/D), and SLA compliance.")
    ]
    for b_txt, n_txt in items_t3:
        p = tf.add_paragraph()
        p.space_after = Pt(8)
        add_run(p, b_txt, bold=True, color=TEXT_WHITE, size_pt=10)
        add_run(p, n_txt, color=TEXT_MUTED, size_pt=9.5)

    # =========================================================================
    # SLIDE 4: CORE ALGORITHMS & DES ENGINE MECHANICS
    # =========================================================================
    s4 = prs.slides.add_slide(blank_layout)
    set_slide_background(s4)
    add_header(s4, "Event Loop Mechanics, Scheduling Policies & Autoscaling", "ALGORITHMS & DES ENGINE")

    q_w = Inches(5.66)
    q_h = Inches(2.4)
    
    # Q1: Event Loop Mechanics
    add_card(s4, Inches(0.8), Inches(1.5), q_w, q_h, "Discrete-Event Simulation (DES) Loop", ACCENT_CYAN)
    tb = s4.shapes.add_textbox(Inches(0.95), Inches(2.0), q_w - Inches(0.3), q_h - Inches(0.6))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    add_run(p, "• Min-Heap Ordering: Events ordered by timestamp; simulation clock advances instantaneously to next event.\n• Core Events: TASK_ARRIVE, TASK_DISPATCH, TASK_COMPLETE, AUTOSCALE_EVALUATE, NODE_FAILURE/RECOVER.\n• Sub-Millisecond Speed: 80s of complex cluster activity simulated in ~0.5 ms.", color=TEXT_MUTED, size_pt=9.5)

    # Q2: Scheduling & Routing Algorithms
    add_card(s4, Inches(6.86), Inches(1.5), q_w, q_h, "4 Core Scheduling & Routing Policies", ACCENT_EMERALD)
    tb = s4.shapes.add_textbox(Inches(7.01), Inches(2.0), q_w - Inches(0.3), q_h - Inches(0.6))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    add_run(p, "• Round Robin (RR): Cyclic node dispatch (i mod N). Ignores task duration heterogeneity.\n• Least Loaded (LL): Routes to node with min load: 0.5*(CPU%) + 0.5*(RAM%). Optimal balance.\n• Priority Based (PB): Inspects priority metadata (High/Med/Low); protects critical traffic.\n• First Fit (FF): Greedily allocates to earliest node; prone to head-of-line bottlenecks.", color=TEXT_MUTED, size_pt=9.5)

    # Q3: Autoscaling Hysteresis
    add_card(s4, Inches(0.8), Inches(4.2), q_w, q_h, "Dual-Threshold Elastic Autoscaling", ACCENT_AMBER)
    tb = s4.shapes.add_textbox(Inches(0.95), Inches(4.7), q_w - Inches(0.3), q_h - Inches(0.6))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    add_run(p, "• Scale-Out: Average CPU > 75% -> provisions +1 node (up to N_max) & starts cooldown.\n• Scale-In: Average CPU < 28-30% -> gracefully drains -1 node (down to N_min) & starts cooldown.\n• Thrashing Prevention: Cooldown period (8-15s) prevents wasteful oscillation under rapid bursts.", color=TEXT_MUTED, size_pt=9.5)

    # Q4: Queue Starvation Accounting
    add_card(s4, Inches(6.86), Inches(4.2), q_w, q_h, "Horizon Accounting & Anti-Starvation Guard", ACCENT_ROSE)
    tb = s4.shapes.add_textbox(Inches(7.01), Inches(4.7), q_w - Inches(0.3), q_h - Inches(0.6))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    add_run(p, "• Starvation Flaw: Without accounting, policies leaving requests stranded in queues appear to have low latency!\n• Mathematical Fix: All admitted requests remaining in queue at T = 60s/80s horizon are incorporated into latency:\n  Latency_starved = T_horizon - T_arrival.\n• Prevents algorithms from artificially gaming SLA grades via queue starvation.", color=TEXT_MUTED, size_pt=9.5)

    # =========================================================================
    # SLIDE 5: AWS CLOUD SERVICES MAPPING & ARCHITECTURE
    # =========================================================================
    s5 = prs.slides.add_slide(blank_layout)
    set_slide_background(s5)
    add_header(s5, "Simulated Primitives vs. Real-World AWS Cloud Architecture", "AWS ARCHITECTURE MAPPING")

    card_w = Inches(11.733)
    c_h = Inches(0.88)
    spacing = Inches(0.98)
    base_top = Inches(1.4)

    aws_cards = [
        ("Virtual Compute Nodes", "Amazon EC2", "t3.medium / c5.large virtual instances running Linux containers; handles multi-core vCPU/RAM allocation and crash recovery.", "750 hrs/mo free t2.micro"),
        ("Request Dispatcher", "AWS Application Load Balancer (ALB)", "Layer 7 HTTP/HTTPS reverse proxy distributing traffic across target groups using Least Outstanding Requests / Round Robin.", "750 hrs/mo + 15 LCUs free"),
        ("Autoscaler Engine", "AWS Auto Scaling Groups (ASG)", "Dynamic target tracking and step scaling policies adjusting EC2 capacity between Min/Max bounds based on CloudWatch metrics.", "Free (pay only for EC2)"),
        ("Telemetry Aggregator", "Amazon CloudWatch", "Collects detailed 0.5s metrics (CPU, RAM, queue depth, throughput) and evaluates SLA breach alarm triggers.", "10 metrics + 1M API calls free"),
        ("Task Queue Buffer", "Amazon SQS / ALB Target Buffer", "Decouples bursty client requests from backend nodes; drops excess traffic when buffers exceed capacity limits.", "1,000,000 requests/mo free")
    ]

    for idx, (sim_name, aws_name, desc, free_tier) in enumerate(aws_cards):
        top_y = base_top + spacing * idx
        add_card(s5, Inches(0.8), top_y, card_w, c_h, border_color=ACCENT_CYAN if idx % 2 == 0 else CARD_BORDER)
        
        tb = s5.shapes.add_textbox(Inches(0.95), top_y + Inches(0.08), card_w - Inches(0.3), c_h - Inches(0.16))
        tf = tb.text_frame
        tf.word_wrap = True
        
        p = tf.paragraphs[0]
        add_run(p, f"{sim_name}  <===>  ", bold=True, color=ACCENT_CYAN, size_pt=11)
        add_run(p, f"{aws_name}  ", bold=True, color=ACCENT_EMERALD, size_pt=11)
        add_run(p, f"[{free_tier}]\n", bold=True, color=ACCENT_AMBER, size_pt=9.5)
        add_run(p, desc, color=TEXT_MUTED, size_pt=9.5)

    # =========================================================================
    # SLIDE 6: LIVE WORKBENCH: WORKLOAD STUDIO & SIMULATION COCKPIT
    # =========================================================================
    s6 = prs.slides.add_slide(blank_layout)
    set_slide_background(s6)
    add_header(s6, "Interactive Cockpit: Scenario Authoring & Mid-Run Replay", "WORKLOAD STUDIO & CONSOLE")

    img_w = Inches(5.66)
    img_h = Inches(3.54)
    img_top = Inches(1.5)

    img1_path = os.path.abspath("Report/screenshots/01_workload_studio.png")
    if os.path.exists(img1_path):
        s6.shapes.add_picture(img1_path, Inches(0.8), img_top, img_w, img_h)
    
    img2_path = os.path.abspath("Report/screenshots/02_simulation_console.png")
    if os.path.exists(img2_path):
        s6.shapes.add_picture(img2_path, Inches(6.86), img_top, img_w, img_h)

    add_card(s6, Inches(0.8), Inches(5.2), img_w, Inches(1.8), "Workload Studio Capabilities", ACCENT_CYAN)
    tb = s6.shapes.add_textbox(Inches(0.95), Inches(5.6), img_w - Inches(0.3), Inches(1.3))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    add_run(p, "• Scenario Presets: 1-click loading of Full Lifecycle, Traffic Surge, or Fault Tolerance.\n• Granular Parameters: Workload arrival rates, vCPU/RAM ranges, priority ratios (High/Med/Low).\n• Chaos Injection: Programmed traffic surges (+120 reqs) and server crash/recovery timestamps.", color=TEXT_MUTED, size_pt=9.5)

    add_card(s6, Inches(6.86), Inches(5.2), img_w, Inches(1.8), "Simulation Console Observability", ACCENT_EMERALD)
    tb = s6.shapes.add_textbox(Inches(7.01), Inches(5.6), img_w - Inches(0.3), Inches(1.3))
    tf = tb.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    add_run(p, "• 2-Column Bento Cockpit: Node health badges (HEALTHY, BUSY, OVERLOADED).\n• Threshold Observability: Dashed 75% scale-up and 28% scale-down autoscaling target lines.\n• Decision Trace Log: Live audit trail detailing every dispatch, enqueue, and scaling decision.", color=TEXT_MUTED, size_pt=9.5)

    # =========================================================================
    # SLIDE 7: LIVE ANALYTICS & SLA HORIZON ACCOUNTING
    # =========================================================================
    s7 = prs.slides.add_slide(blank_layout)
    set_slide_background(s7)
    add_header(s7, "Post-Simulation Observability: SLA Escalation & Horizon Metrics", "RESULTS & ANALYTICS")

    img3_path = os.path.abspath("Report/screenshots/03_results_analytics.png")
    if os.path.exists(img3_path):
        s7.shapes.add_picture(img3_path, Inches(0.8), Inches(1.5), Inches(7.2), Inches(4.5))

    right_w = Inches(4.2)
    right_x = Inches(8.333)
    add_card(s7, right_x, Inches(1.5), right_w, Inches(5.4), "SLA & Horizon Highlights", ACCENT_CYAN)
    
    tb = s7.shapes.add_textbox(right_x + Inches(0.15), Inches(2.1), right_w - Inches(0.3), Inches(4.6))
    tf = tb.text_frame
    tf.word_wrap = True
    
    highlights = [
        ("Dynamic SLA Escalation: ", "Pipeline badge escalates dynamically: Healthy (>=95%), At Risk (80-95%), or Breached (<80% or latency > target)."),
        ("Horizon Accounting: ", "Distinguishes completed requests from in-flight and starved tasks caught at cutoff T = 80.0s."),
        ("Latency Percentiles: ", "Displays p50, p95, and p99 latency tails to capture tail-end degradation during spike windows."),
        ("Virtual Cost Modeling: ", "Translates vCPU-hour and RAM-hour consumption into real-time operational expense ($0.0222).")
    ]
    for b_txt, n_txt in highlights:
        p = tf.add_paragraph()
        p.space_after = Pt(12)
        add_run(p, b_txt, bold=True, color=TEXT_WHITE, size_pt=10)
        add_run(p, n_txt, color=TEXT_MUTED, size_pt=9.5)

    # =========================================================================
    # SLIDE 8: MULTI-POLICY COMPARATIVE BENCHMARKING
    # =========================================================================
    s8 = prs.slides.add_slide(blank_layout)
    set_slide_background(s8)
    add_header(s8, "Empirical Benchmark: Head-to-Head Policy Evaluation", "COMPARISON STUDIO BENCHMARK")

    img4_path = os.path.abspath("Report/screenshots/04_comparison_studio.png")
    if os.path.exists(img4_path):
        s8.shapes.add_picture(img4_path, Inches(0.8), Inches(1.5), Inches(7.2), Inches(4.5))

    add_card(s8, right_x, Inches(1.5), right_w, Inches(5.4), "Empirical Findings", ACCENT_EMERALD)
    tb = s8.shapes.add_textbox(right_x + Inches(0.15), Inches(2.1), right_w - Inches(0.3), Inches(4.6))
    tf = tb.text_frame
    tf.word_wrap = True

    findings = [
        ("Rank #1: Priority Based: ", "Achieves highest SLA compliance (91.90%) and lowest drop count (4 requests) by expediting high-tier tasks during server failure."),
        ("Rank #2: Least Loaded: ", "Delivers lowest avg latency (3,062 ms), outperforming Round Robin by 460 ms through balanced queue distribution."),
        ("Rank #3: Round Robin: ", "Baseline cyclic routing achieves 81.52% SLA compliance; suffers from load skew when long tasks group on single nodes."),
        ("Rank #4: First Fit: ", "Breaches SLA target with 5,062 ms avg latency (76.84% SLA) due to catastrophic head-of-line blocking on node-1.")
    ]
    for b_txt, n_txt in findings:
        p = tf.add_paragraph()
        p.space_after = Pt(10)
        add_run(p, b_txt, bold=True, color=TEXT_WHITE, size_pt=10)
        add_run(p, n_txt, color=TEXT_MUTED, size_pt=9.5)

    # =========================================================================
    # SLIDE 9: CONCLUSION & ROADMAP
    # =========================================================================
    s9 = prs.slides.add_slide(blank_layout)
    set_slide_background(s9)
    add_header(s9, "Summary of Achievements & Future Research Roadmap", "CONCLUSION & ROADMAP")

    ach_w = Inches(5.66)
    ach_h = Inches(5.2)
    add_card(s9, Inches(0.8), Inches(1.5), ach_w, ach_h, "Key Project Achievements", ACCENT_CYAN)
    tb = s9.shapes.add_textbox(Inches(0.95), Inches(2.1), ach_w - Inches(0.3), ach_h - Inches(0.8))
    tf = tb.text_frame
    tf.word_wrap = True
    achievements = [
        ("Deterministic High-Speed Engine: ", "Built native C++14 discrete-event core executing 300+ event cloud simulations in sub-millisecond time (<1.0 ms)."),
        ("SLA Integrity & Anti-Starvation: ", "Resolved critical metrics vulnerabilities via post-horizon queue drain accounting and dynamic SLA escalation."),
        ("Zero-Cost Educational Platform: ", "Replaced expensive AWS live testing with bit-exact, interactive visual simulations."),
        ("AWS Production Alignment: ", "Direct architectural mapping between simulated nodes and EC2, ALB, ASG, CloudWatch, and SQS.")
    ]
    for b_txt, n_txt in achievements:
        p = tf.add_paragraph()
        p.space_after = Pt(12)
        add_run(p, b_txt, bold=True, color=TEXT_WHITE, size_pt=10.5)
        add_run(p, n_txt, color=TEXT_MUTED, size_pt=10)

    add_card(s9, Inches(6.86), Inches(1.5), ach_w, ach_h, "Future Research Scope", ACCENT_EMERALD)
    tb = s9.shapes.add_textbox(Inches(7.01), Inches(2.1), ach_w - Inches(0.3), ach_h - Inches(0.8))
    tf = tb.text_frame
    tf.word_wrap = True
    roadmap = [
        ("Reinforcement Learning Autoscaling: ", "Integrate Gym/Gymnasium environment to train PPO / DQN neural agents for predictive elasticity."),
        ("Multi-Region Geo-Routing: ", "Simulate global Anycast routing across multi-region VPC topologies with egress data transfer costs."),
        ("Microservice DAG Workloads: ", "Model distributed microservice dependencies (RPC chains, fan-out, circuit-breakers)."),
        ("Live CloudWatch Exporter: ", "Export simulated metric telemetry directly into live AWS CloudWatch dashboards via AWS SDK.")
    ]
    for b_txt, n_txt in roadmap:
        p = tf.add_paragraph()
        p.space_after = Pt(12)
        add_run(p, b_txt, bold=True, color=TEXT_WHITE, size_pt=10.5)
        add_run(p, n_txt, color=TEXT_MUTED, size_pt=10)

    output_pptx = os.path.abspath("Report/Cloud_Event_Simulator_Presentation.pptx")
    prs.save(output_pptx)
    print(f"Presentation saved successfully to: {output_pptx}")

if __name__ == "__main__":
    build_presentation()
