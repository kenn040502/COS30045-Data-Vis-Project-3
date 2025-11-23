const drawChart1 = (data) => {
  const margin = { top: 50, right: 60, bottom: 80, left: 80 };

  const container = d3.select("#chart1");
  container.selectAll("*").remove();

  const bounds = container.node().getBoundingClientRect();
  const width = Math.max(320, bounds.width || 900);
  const height = Math.max(360, bounds.height || 500);

  // -----------------------------
  // 1. Prepare Data
  // -----------------------------
  const ageOrder = [
    "0-16", "17-25", "26-39", "40-64", "65 and over", "All ages", "Unknown"
  ];

  const chartData = data.map(d => ({
    ageGroup: d.AGE_GROUP,
    year: 2023,
    positiveValue: +d["2023"]
  })).concat(
    data.map(d => ({
      ageGroup: d.AGE_GROUP,
      year: 2024,
      positiveValue: +d["2024"]
    }))
  );

  // -----------------------------
  // 2. SVG Setup
  // -----------------------------
  const svg = container
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("width", "100%")
    .attr("height", "100%");

  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const innerChart = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const tooltip = container
    .append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("background", "white")
    .style("border", "1px solid #ccc")
    .style("border-radius", "6px")
    .style("padding", "8px 12px")
    .style("font-size", "13px")
    .style("pointer-events", "none")
    .style("opacity", 0);

  // -----------------------------
  // 3. Scales
  // -----------------------------
  const x0 = d3.scaleBand()
    .domain(ageOrder)
    .range([0, chartWidth])
    .paddingInner(0.2)
    .paddingOuter(0.05);

  const x1 = d3.scaleBand()
    .domain([2023, 2024])
    .range([0, x0.bandwidth()])
    .padding(0.1);

  const y = d3.scaleLinear()
    .domain([0, d3.max(chartData, d => d.positiveValue)])
    .nice()
    .range([chartHeight, 0]);

  const color = d3.scaleOrdinal()
    .domain([2023, 2024])
    .range(["#00176B", "rgba(0, 23, 107, 0.3)"]);

  // Add annotation layer
  const annotationLayer = innerChart.append("g").attr("class", "annotation-layer");

  // -----------------------------
  // 4. Draw Bars
  // -----------------------------
  const groups = innerChart.selectAll(".ageGroup")
    .data(d3.group(chartData, d => d.ageGroup))
    .join("g")
    .attr("transform", d => `translate(${x0(d[0])},0)`);

  groups.selectAll(".bar")
    .data(d => d[1])
    .join("rect")
    .attr("class", d => `positive-bar bar-${d.year}`)
    .attr("x", d => x1(d.year))
    .attr("y", chartHeight)
    .attr("width", x1.bandwidth())
    .attr("height", 0)
    .attr("fill", d => color(d.year))
    .attr("rx", 4)
    .attr("ry", 4)
    .style("cursor", "pointer")
    .on("mouseover", (event, d) => {
      tooltip.style("opacity", 1).html(`
        <strong>${d.year}</strong><br/>
        Age Group: ${d.ageGroup}<br/>
        Positive Tests: ${d.positiveValue.toLocaleString()}
      `);
    })
    .on("mousemove", (event) => {
      tooltip.style("left", event.pageX + 12 + "px")
        .style("top", event.pageY - 20 + "px");
    })
    .on("mouseout", () => tooltip.style("opacity", 0))
    .transition()
    .duration(800)
    .delay((_, i) => i * 60)
    .ease(d3.easeCubicOut)
    .attr("y", d => y(d.positiveValue))
    .attr("height", d => chartHeight - y(d.positiveValue));

  // -----------------------------
  // 5. Axes
  // -----------------------------
  innerChart.append("g")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(d3.axisBottom(x0).tickSizeOuter(0));

  innerChart.append("g").call(d3.axisLeft(y));

  // -----------------------------
  // 6. Highlight 0-16 (Low Sample)
  // -----------------------------
  const lowSampleGroup = "0-16";
  const lowBars = chartData.filter(d => d.ageGroup === lowSampleGroup);

  if (lowBars.length > 0) {
      const gx = x0(lowSampleGroup);
      const maxVal = d3.max(lowBars, d => d.positiveValue);

      annotationLayer.append("rect")
          .attr("x", gx - 5)
          .attr("y", y(maxVal) - 10)
          .attr("width", x0.bandwidth() + 10)
          .attr("height", chartHeight - y(maxVal) + 10)
          .attr("fill", "rgba(255,0,0,0.08)")
          .attr("stroke", "red")
          .attr("stroke-dasharray", "4,2")
          .attr("rx", 6)
          .attr("ry", 6)
          .style("pointer-events", "none");

      annotationLayer.append("text")
          .attr("x", gx + x0.bandwidth() / 2)
          .attr("y", y(maxVal) - 15)
          .attr("text-anchor", "middle")
          .attr("fill", "red")
          .style("font-size", "12px")
          .style("font-weight", "bold")
          .text("Low sample size");
  }

  // -----------------------------
  // 7. Title
  // -----------------------------
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", 25)
    .attr("text-anchor", "middle")
    .style("font-size", "18px")
    .style("font-weight", "bold")
    .text("Positive Roadside Drug Detections by Age Group (2023-2024)");

  // -----------------------------
  // 8. Legend
  // -----------------------------
  const legend = svg.append("g")
    .attr("transform", `translate(${width / 2 - 200}, ${height - 45})`);

  [2023, 2024].forEach((year, i) => {
    const yOffset = i * 25;
    legend.append("rect")
      .attr("x", 0)
      .attr("y", yOffset)
      .attr("width", 18)
      .attr("height", 18)
      .attr("fill", color(year));

    legend.append("text")
      .attr("x", 25)
      .attr("y", yOffset + 13)
      .style("font-size", "13px")
      .text(`${year}: Positive detections`);
  });

  // -----------------------------
  // 9. Trend Comparison Button
  // -----------------------------
  d3.select("#compareBtn").on("click", function () {
    const btn = d3.select(this);

    if (window.compareActive) {
      window.compareActive = false;
      btn.text("Compare 2023 & 2024 Trends");
      innerChart.selectAll(".trend-line, .trend-points").remove();
      d3.selectAll(".positive-bar").attr("opacity", 1);
      return;
    }

    window.compareActive = true;
    btn.text("Reset Comparison");

    d3.selectAll(".positive-bar").attr("opacity", 0.25);

    innerChart.selectAll(".trend-line, .trend-points").remove();

    const getCenterX = ag => x0(ag) + x0.bandwidth() / 2;

    [2023, 2024].forEach(year => {
      const yearData = chartData.filter(d => d.year === year);

      const line = d3.line()
        .x(v => getCenterX(v.ageGroup))
        .y(v => y(v.positiveValue))
        .curve(d3.curveMonotoneX);

      innerChart.append("path")
        .datum(yearData)
        .attr("class", "trend-line")
        .attr("fill", "none")
        .attr("stroke", color(year))
        .attr("stroke-width", 3)
        .attr("stroke-dasharray", year === 2023 ? "6,3" : null)
        .attr("d", line);

      innerChart.selectAll(`.trend-points-${year}`)
        .data(yearData)
        .join("circle")
        .attr("class", "trend-points")
        .attr("cx", v => getCenterX(v.ageGroup))
        .attr("cy", v => y(v.positiveValue))
        .attr("r", 5)
        .attr("fill", color(year))
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5);
    });
  });
};
