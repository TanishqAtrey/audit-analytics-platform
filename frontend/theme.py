"""
Central visual identity for the whole app — call inject_theme() once at
the top of every page. Streamlit's multipage model runs each page as an
independent script, so CSS injected on one page doesn't carry to the next.

Palette: near-black/charcoal base, beige for anything code/data-shaped
("cloud" panels), green + blue as the functional colors for actions,
charts, and most UI accents. Exception severity keeps the conventional
green→amber→red traffic-light scale in charts.py — that's a deliberate
exception to the green/blue rule, since scannable risk color is exactly
what an auditor's eye needs.
"""

import streamlit as st
import streamlit.components.v1 as components

PALETTE = {
    "black": "#0B0B0C", "charcoal": "#141416", "charcoal_light": "#1C1C20",
    "beige": "#F5EFE0", "beige_dim": "#D8CFB8",
    "green": "#22C55E", "green_dark": "#15803D",
    "blue": "#3B82F6", "blue_dark": "#1D4ED8",
    "teal": "#2DD4BF", "amber": "#F59E0B", "red": "#EF4444",
}

_CUSTOM_CSS = f"""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap');

html, body, [class*="css"] {{ font-family: 'Inter', sans-serif; }}

.stApp {{
    background: radial-gradient(circle at 20% -10%, {PALETTE['charcoal_light']} 0%, {PALETTE['black']} 55%);
    color: {PALETTE['beige']};
}}

/* ---------- 3D animated hero title ---------- */
.hero-title {{
    font-size: 3rem; font-weight: 800; text-align: center; letter-spacing: 0.5px;
    color: {PALETTE['beige']}; perspective: 900px; transform-style: preserve-3d;
    text-shadow: 1px 1px 0 #000, 2px 2px 0 #000, 3px 3px 0 #000, 4px 4px 6px rgba(0,0,0,0.55);
    animation: hero-3d-float 6s ease-in-out infinite;
    margin-bottom: 0.2rem;
}}
.hero-title .accent {{
    background: linear-gradient(90deg, {PALETTE['blue']}, {PALETTE['green']}, {PALETTE['teal']}, {PALETTE['blue']});
    background-size: 300% 100%;
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
    animation: hero-shimmer 5s linear infinite;
}}
@keyframes hero-3d-float {{
    0%   {{ transform: translateY(0) rotateX(0deg) rotateY(0deg); }}
    25%  {{ transform: translateY(-6px) rotateX(3deg) rotateY(3deg); }}
    50%  {{ transform: translateY(0) rotateX(0deg) rotateY(0deg); }}
    75%  {{ transform: translateY(6px) rotateX(-3deg) rotateY(-3deg); }}
    100% {{ transform: translateY(0) rotateX(0deg) rotateY(0deg); }}
}}
@keyframes hero-shimmer {{ 0% {{ background-position: 0% 50%; }} 100% {{ background-position: 300% 50%; }} }}
.hero-subtitle {{ text-align: center; color: {PALETTE['beige_dim']}; font-size: 1.05rem; margin-top: 0; margin-bottom: 1.5rem; }}

/* ---------- "cloud" code panels — beige/black ---------- */
pre, code, [data-testid="stCodeBlock"] pre, [data-testid="stCodeBlock"] code {{
    background-color: {PALETTE['beige']} !important;
    color: {PALETTE['black']} !important;
    border-radius: 12px !important;
    font-family: 'JetBrains Mono', monospace !important;
    border: 1px solid #00000022 !important;
}}
[data-testid="stCodeBlock"] {{
    position: relative;
    box-shadow: 0 6px 18px rgba(0,0,0,0.35);
    animation: cloud-drift 6s ease-in-out infinite;
}}
[data-testid="stCodeBlock"]::before {{
    content: "☁"; position: absolute; top: -10px; left: 12px; font-size: 1rem;
    color: {PALETTE['black']}; background: {PALETTE['beige']}; padding: 0 6px; border-radius: 50%;
}}
@keyframes cloud-drift {{ 0%, 100% {{ transform: translateY(0); }} 50% {{ transform: translateY(-3px); }} }}

/* ---------- cards ---------- */
[data-testid="stVerticalBlockBorderWrapper"] {{
    background: {PALETTE['charcoal_light']}; border: 1px solid #ffffff14; border-radius: 14px;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}}
[data-testid="stVerticalBlockBorderWrapper"]:hover {{
    transform: translateY(-2px); box-shadow: 0 10px 24px rgba(59,130,246,0.15);
}}

/* ---------- buttons ---------- */
.stButton>button {{
    background: linear-gradient(90deg, {PALETTE['blue']}, {PALETTE['green']});
    color: #06110A; font-weight: 700; border: none; border-radius: 10px;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
}}
.stButton>button:hover {{ transform: translateY(-1px) scale(1.02); box-shadow: 0 6px 16px rgba(34,197,94,0.35); }}

/* ---------- reason code badges ---------- */
.reason-badge {{
    background: {PALETTE['charcoal_light']}; border-radius: 10px; padding: 0.55rem 0.8rem;
    margin-bottom: 0.5rem; animation: fade-in-up 0.4s ease-out;
}}
.reason-badge-header {{ display:flex; justify-content:space-between; font-size:0.9rem; }}
.reason-badge-score {{ color:{PALETTE['beige_dim']}; font-family:'JetBrains Mono', monospace; }}
.reason-badge-bar-track {{ height:6px; background:#ffffff14; border-radius:4px; margin:6px 0; overflow:hidden; }}
.reason-badge-bar-fill {{ height:100%; border-radius:4px; transform-origin:left; animation: grow-bar 0.8s ease-out; }}
.reason-badge-explanation {{ font-size:0.85rem; color:{PALETTE['beige_dim']}; }}
@keyframes grow-bar {{ from {{ transform: scaleX(0); }} to {{ transform: scaleX(1); }} }}
@keyframes fade-in-up {{ from {{ opacity:0; transform: translateY(6px);}} to {{opacity:1; transform:translateY(0);}} }}

/* ---------- sidebar + metrics ---------- */
[data-testid="stSidebar"] {{ background: {PALETTE['black']}; border-right: 1px solid #ffffff14; }}
[data-testid="stMetric"] {{ background: {PALETTE['charcoal_light']}; border-radius: 12px; padding: 0.8rem; border: 1px solid #ffffff14; }}
[data-testid="stMetricValue"] {{
    background: linear-gradient(90deg, {PALETTE['green']}, {PALETTE['blue']});
    -webkit-background-clip: text; background-clip:text; -webkit-text-fill-color: transparent;
}}
</style>
"""

# Wireframe icosahedron ("transaction network") + orbiting particles
# ("anomalies") — genuine WebGL 3D, not a CSS approximation. Guarded with
# a `typeof THREE === 'undefined'` check so a blocked/offline CDN just
# skips the canvas instead of breaking the page — the CSS 3D title above
# still renders either way.
_HERO_CANVAS_HTML = """
<div id="hero-3d-canvas" style="width:100%; height:200px;"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
(function () {
    const container = document.getElementById('hero-3d-canvas');
    if (!container || typeof THREE === 'undefined') return;
    const width = container.clientWidth || 900, height = 200;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.z = 32;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    container.appendChild(renderer.domElement);

    const geometry = new THREE.IcosahedronGeometry(10, 1);
    const wireframe = new THREE.WireframeGeometry(geometry);
    const network = new THREE.LineSegments(wireframe,
        new THREE.LineBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.55 }));
    scene.add(network);

    const particleCount = 70;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
        const radius = 13 + Math.random() * 7;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        positions[i * 3]     = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = radius * Math.cos(phi);
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(particleGeometry,
        new THREE.PointsMaterial({ color: 0x3b82f6, size: 0.7 }));
    scene.add(particles);

    function animate() {
        requestAnimationFrame(animate);
        network.rotation.y += 0.0025; network.rotation.x += 0.001;
        particles.rotation.y -= 0.0018;
        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', function () {
        const w = container.clientWidth || width;
        camera.aspect = w / height; camera.updateProjectionMatrix();
        renderer.setSize(w, height);
    });
})();
</script>
"""


def inject_theme() -> None:
    st.markdown(_CUSTOM_CSS, unsafe_allow_html=True)


def render_hero(title_prefix: str = "Audit", title_accent: str = "Analytics Platform",
                 subtitle: str = "One detection core. Two domains. Every flag explained.") -> None:
    components.html(_HERO_CANVAS_HTML, height=210)
    st.markdown(
        f'<div class="hero-title">{title_prefix} <span class="accent">{title_accent}</span></div>'
        f'<p class="hero-subtitle">{subtitle}</p>',
        unsafe_allow_html=True,
    )