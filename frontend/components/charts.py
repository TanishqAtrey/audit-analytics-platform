"""Plotly chart builders — every chart in the app goes through here so the
green/blue palette and animated-transition template stay consistent."""

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import plotly.io as pio

from frontend.theme import PALETTE

_TEMPLATE = go.layout.Template(layout=go.Layout(
    paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
    font=dict(color=PALETTE["beige"], family="Inter, sans-serif"),
    colorway=[PALETTE["blue"], PALETTE["green"], PALETTE["teal"], PALETTE["amber"], PALETTE["red"]],
    xaxis=dict(gridcolor="rgba(245,239,224,0.08)", zerolinecolor="rgba(245,239,224,0.15)"),
    yaxis=dict(gridcolor="rgba(245,239,224,0.08)", zerolinecolor="rgba(245,239,224,0.15)"),
    legend=dict(bgcolor="rgba(0,0,0,0)"), transition=dict(duration=500, easing="cubic-in-out"),
    margin=dict(t=50, b=30, l=30, r=20),
))
pio.templates["audit_platform"] = _TEMPLATE
pio.templates.default = "audit_platform"


def benford_digit_distribution_chart(observed: dict, expected: dict,
                                       title: str = "Benford's Law: Digit Distribution") -> go.Figure:
    digits = sorted(observed.keys(), key=lambda d: int(d))
    fig = go.Figure()
    fig.add_trace(go.Bar(x=digits, y=[observed[d] for d in digits], name="Observed", marker_color=PALETTE["blue"]))
    fig.add_trace(go.Scatter(x=digits, y=[expected[d] for d in digits], name="Expected (Benford)",
                              mode="lines+markers", line=dict(color=PALETTE["green"], width=3)))
    fig.update_layout(title=title, barmode="group", height=380)
    return fig


def benchmark_comparison_chart(baseline: dict, ensemble: dict,
                                 baseline_label="Naive Baseline", ensemble_label="Full Ensemble") -> go.Figure:
    metrics = ["precision", "recall", "f1"]
    fig = go.Figure()
    fig.add_trace(go.Bar(name=baseline_label, x=[m.capitalize() for m in metrics],
                          y=[baseline[m] for m in metrics], marker_color=PALETTE["blue"]))
    fig.add_trace(go.Bar(name=ensemble_label, x=[m.capitalize() for m in metrics],
                          y=[ensemble[m] for m in metrics], marker_color=PALETTE["green"]))
    fig.update_layout(barmode="group", yaxis=dict(range=[0, 1]), height=400, title="Baseline vs Ensemble")
    return fig


def flagged_over_time_chart(exceptions: list[dict]) -> go.Figure:
    if not exceptions:
        return go.Figure()
    df = pd.DataFrame(exceptions)
    df["created_at"] = pd.to_datetime(df["created_at"])
    df["month"] = df["created_at"].dt.to_period("M").astype(str)
    grouped = df.groupby(["month", "domain"]).size().reset_index(name="count")

    fig = px.bar(grouped, x="domain", y="count", color="domain", animation_frame="month",
                 color_discrete_map={"ledger": PALETTE["blue"], "financial_statement": PALETTE["green"]},
                 range_y=[0, grouped["count"].max() + 5], title="Flagged Exceptions Over Time")
    fig.update_layout(height=380, showlegend=False)
    return fig


def score_gauge(score: float, title: str = "Ensemble Score") -> go.Figure:
    # Deliberately breaks from green/blue here: green→amber→red is the
    # convention an auditor scanning risk actually needs.
    fig = go.Figure(go.Indicator(
        mode="gauge+number", value=round(score * 100, 1),
        title={"text": title, "font": {"size": 14}}, number={"suffix": "/100"},
        gauge={
            "axis": {"range": [0, 100]}, "bar": {"color": PALETTE["blue"]}, "bgcolor": "rgba(0,0,0,0)",
            "steps": [
                {"range": [0, 40], "color": "rgba(34,197,94,0.35)"},
                {"range": [40, 65], "color": "rgba(245,158,11,0.35)"},
                {"range": [65, 100], "color": "rgba(239,68,68,0.35)"},
            ],
        },
    ))
    fig.update_layout(height=240, margin=dict(t=40, b=10, l=20, r=20))
    return fig