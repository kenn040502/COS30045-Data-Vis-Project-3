const drawChart1 = (data) => {
  const margin = { top: 50, right: 60, bottom: 80, left: 80 };
  const width = 900;
  const height = 500;

  // -----------------------------
  // 1. Data Preparation
  // -----------------------------
  const baseFiltered = data.filter(
    d => (d.year == 2023 || d.year == 2024) &&
         d.ageGroup && d.ageGroup.trim() !== ""
  );

  const positiveFiltered = baseFiltered.filter(
    d => d.bestDetectionMethod?.toLowerCase() === "yes"
  );

  // Group by Age Group × Year
  const totalGrouped = d3.rollups(
    baseFiltered,
    v => d3.sum(v, d => d.count),
    d => d.ageGroup,
    d => +d.year
  );

  const positiveGrouped = d3.rollups(
    positiveFiltered,
    v => d3.sum(v, d => d.count),
    d => d.ageGroup,
    d => +d.year
  );

  // Merge total + positive data
  const allYears = [2023, 2024];
  const chartData = [];

  for (const [ageGroup, yearValues] of totalGrouped) {
    for (const year of allYears) {
      const totalTests = yearValues.find(([y]) => y === year)?.[1] || 0;
      const positiveValue =
        positiveGrouped
          .find(([ag]) => ag === ageGroup)?.[1]
          ?.find(([y]) => y === year)?.[1] || 0;
      chartData.push({ ageGroup, year, totalTests, positiveValue });
    }
  }

  const customAgeOrder = [
    "0-16", "17-25", "26-39", "40-64", "65 and over", "All ages", "Unknown"
  ];

  const ageOrder = customAgeOrder.filter(age =>
    chartData.some(d => d.ageGroup === age)
  );

  // -----------------------------
  // 2. SVG Setup
  // -----------------------------
  const svg = d3.select("#chart1")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const innerChart = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Tooltip setup
  const tooltip = d3.select("#chart1")
    .append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("background", "rgba(255,255,255,0.95)")
    .style("border", "1px solid #ccc")
    .style("border-radius", "6px")
    .style("padding", "8px 12px")
    .style("font-size", "13px")
    .style("pointer-events", "none")
    .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)")
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
    .padding(0.05);

  const y = d3.scaleLinear()
    .domain([0, d3.max(chartData, d => d.totalTests)]).nice()
    .range([chartHeight, 0]);

  const color = d3.scaleOrdinal()
    .domain([2023, 2024])
    .range(["#4e79a7", "#f28e2b"]);

  // -----------------------------
  // 4. Draw Bars (Total + Positive)
  // -----------------------------
  const groups = innerChart.selectAll(".ageGroup")
    .data(d3.group(chartData, d => d.ageGroup))
    .join("g")
    .attr("transform", d => `translate(${x0(d[0])},0)`);

  // Light bars = total tests
  groups.selectAll(".total-bar")
    .data(d => d[1])
    .join("rect")
    .attr("class", "total-bar")
    .attr("x", d => x1(d.year))
    .attr("y", d => {
      const yVal = y(d.totalTests);
      return Math.min(yVal, chartHeight - 3); // let small bars end slightly above baseline
    })
    .attr("width", x1.bandwidth())
    .attr("height", d => {
      const yVal = y(d.totalTests);
      const barHeight = chartHeight - yVal;
      return Math.max(3, barHeight + (barHeight < 5 ? 2 : 0)); // add height for tiny values
    })
    .attr("fill", d => d.year === 2023 ? "rgba(78,121,167,0.3)" : "rgba(242,142,43,0.3)")
    .style("pointer-events", "none");

  // Solid bars = positive detections
  groups.selectAll(".positive-bar")
    .data(d => d[1])
    .join("rect")
    .attr("class", d => `positive-bar bar-${d.year}`)
    .attr("x", d => x1(d.year))
    .attr("y", d => {
      const yVal = y(d.positiveValue);
      return Math.min(yVal, chartHeight - 3);
    })
    .attr("width", x1.bandwidth())
    .attr("height", d => {
      const yVal = y(d.positiveValue);
      const barHeight = chartHeight - yVal;
      return Math.max(3, barHeight + (barHeight < 5 ? 2 : 0));
    })
    .attr("fill", d => color(d.year))
    .style("cursor", "pointer")
    // Tooltip
    .on("mouseover", (event, d) => {
      tooltip.transition().duration(150).style("opacity", 1);
      tooltip.html(`
        <strong>Year:</strong> ${d.year}<br/>
        <strong>Age Group:</strong> ${d.ageGroup}<br/>
        <strong>Total Tests:</strong> ${d.totalTests.toLocaleString()}<br/>
        <strong>Positive Tests:</strong> ${d.positiveValue.toLocaleString()}<br/>
        <strong>Positivity Rate:</strong> ${(d.positiveValue / d.totalTests * 100).toFixed(1)}%
      `);
    })
    .on("mousemove", (event) => {
      tooltip.style("left", (event.pageX + 12) + "px")
             .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", () => tooltip.transition().duration(200).style("opacity", 0))
    // Toggle trend line
    .on("click", (event, d) => {
      const yearClicked = d.year;
      if (window.activeYear === yearClicked) {
        window.activeYear = null;
        d3.selectAll(".positive-bar").attr("opacity", 1);
        innerChart.selectAll(".trend-line, .trend-points").remove();
        return;
      }

      window.activeYear = yearClicked;
      d3.selectAll(".positive-bar").attr("opacity", 0.3);
      d3.selectAll(`.bar-${yearClicked}`).attr("opacity", 1);
      innerChart.selectAll(".trend-line, .trend-points").remove();

      const yearData = chartData
        .filter(v => v.year === yearClicked)
        .sort((a, b) => ageOrder.indexOf(a.ageGroup) - ageOrder.indexOf(b.ageGroup));

      const line = d3.line()
        .x(v => x0(v.ageGroup) + x1(v.year) + x1.bandwidth() / 2)
        .y(v => y(v.positiveValue))
        .curve(d3.curveMonotoneX);

      innerChart.append("path")
        .datum(yearData)
        .attr("class", "trend-line")
        .attr("fill", "none")
        .attr("stroke", color(yearClicked))
        .attr("stroke-width", 2.5)
        .attr("d", line)
        .attr("opacity", 0)
        .transition()
        .duration(600)
        .attr("opacity", 1);

      innerChart.selectAll(".trend-points")
        .data(yearData)
        .join("circle")
        .attr("class", "trend-points")
        .attr("cx", v => x0(v.ageGroup) + x1(v.year) + x1.bandwidth() / 2)
        .attr("cy", v => y(v.positiveValue))
        .attr("r", 5)
        .attr("fill", color(yearClicked))
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .on("mouseover", (event, v) => {
          tooltip.transition().duration(150).style("opacity", 1);
          tooltip.html(`
            <strong>Year:</strong> ${v.year}<br/>
            <strong>Age Group:</strong> ${v.ageGroup}<br/>
            <strong>Positive Tests:</strong> ${v.positiveValue.toLocaleString()}<br/>
            <strong>Rate:</strong> ${(v.positiveValue / v.totalTests * 100).toFixed(1)}%
          `);
        })
        .on("mousemove", (event) => {
          tooltip.style("left", (event.pageX + 12) + "px")
                 .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", () => tooltip.transition().duration(200).style("opacity", 0));
    });

  // -----------------------------
  // 5. Axes
  // -----------------------------
  const xAxis = d3.axisBottom(x0).tickSizeOuter(0);
  const yAxis = d3.axisLeft(y);

  innerChart.append("g")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(xAxis)
    .selectAll("text")
    .attr("transform", "rotate(0)")
    .attr("text-anchor", "middle")
    .attr("dy", "1.2em");

  innerChart.append("g").call(yAxis);

  // -----------------------------
  // 6. Annotation (0–16 group)
  // -----------------------------
  const lowSampleGroup = "0-16";
  const lowBars = chartData.filter(d => d.ageGroup === lowSampleGroup);

  if (lowBars.length > 0) {
    const minX = x0(lowSampleGroup) + Math.min(...[2023, 2024].map(y => x1(y)));
    const maxX = x0(lowSampleGroup) + Math.max(...[2023, 2024].map(y => x1(y) + x1.bandwidth()));
    const maxY = d3.max(lowBars, d => y(d.positiveValue));

    innerChart.append("rect")
      .attr("x", minX - 5)
      .attr("y", maxY - 25)
      .attr("width", maxX - minX + 10)
      .attr("height", chartHeight - maxY + 30)
      .attr("fill", "rgba(255,0,0,0.08)")
      .attr("stroke", "red")
      .attr("stroke-width", 1.5)
      .attr("rx", 6)
      .attr("ry", 6)
      .style("pointer-events", "none");

    innerChart.append("text")
      .attr("x", (minX + maxX) / 2)
      .attr("y", maxY - 30)
      .attr("text-anchor", "middle")
      .attr("fill", "red")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .style("pointer-events", "none")
      .text("Low sample size");
  }

  // -----------------------------
  // 7. Title
  // -----------------------------
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", margin.top / 2)
    .attr("text-anchor", "middle")
    .style("font-size", "18px")
    .style("font-weight", "bold")
    .text("Drug Tests vs. Positive Detections by Age Group (2023–2024)");

  // -----------------------------
  // 8. Legend (below chart)
  // -----------------------------
  const legend = svg.append("g")
    .attr("transform", `translate(${width / 2 - 200}, ${height - 45})`);

  [2023, 2024].forEach((year, i) => {
    const yOffset = i * 25;

    // Total tests (light)
    legend.append("rect")
      .attr("x", 0)
      .attr("y", yOffset)
      .attr("width", 18)
      .attr("height", 18)
      .attr("fill", year === 2023 ? "rgba(78,121,167,0.3)" : "rgba(242,142,43,0.3)");

    legend.append("text")
      .attr("x", 25)
      .attr("y", yOffset + 13)
      .style("font-size", "13px")
      .text(`${year}: Total tests conducted`);

    // Positive detections (solid)
    legend.append("rect")
      .attr("x", 250)
      .attr("y", yOffset)
      .attr("width", 18)
      .attr("height", 18)
      .attr("fill", color(year));

    legend.append("text")
      .attr("x", 275)
      .attr("y", yOffset + 13)
      .style("font-size", "13px")
      .text(`${year}: Positive drug tests`);

    // -----------------------------
    // 9. Compare Trends Button
    // -----------------------------
    d3.select("#compareBtn").on("click", function() {
    const btn = d3.select(this);

    // If already comparing, reset view
    if (window.compareActive) {
        window.compareActive = false;
        btn.text("Compare 2023 & 2024 Trends");
        innerChart.selectAll(".trend-line, .trend-points").remove();
        d3.selectAll(".positive-bar").attr("opacity", 1);
        return;
    }

    // Activate compare mode
    window.compareActive = true;
    btn.text("Reset Comparison");

    // Dim all bars
    d3.selectAll(".positive-bar").attr("opacity", 0.25);

    // Remove existing trend lines before redrawing
    innerChart.selectAll(".trend-line, .trend-points").remove();

    // Helper: get the center x-position of each age group
    const getCenterX = (ageGroup) => {
        const groupStart = x0(ageGroup);
        const groupEnd = x0(ageGroup) + x0.bandwidth();
        return groupStart + (groupEnd - groupStart) / 2;
    };

    // Draw both trend lines
    const years = [2023, 2024];

    years.forEach(year => {
        const yearData = chartData
        .filter(v => v.year === year)
        .sort((a, b) => ageOrder.indexOf(a.ageGroup) - ageOrder.indexOf(b.ageGroup));

        const line = d3.line()
        .x(v => getCenterX(v.ageGroup))
        .y(v => y(v.positiveValue))
        .curve(d3.curveMonotoneX);

        // Draw line (slightly thicker and styled)
        innerChart.append("path")
        .datum(yearData)
        .attr("class", "trend-line")
        .attr("fill", "none")
        .attr("stroke", color(year))
        .attr("stroke-width", 3)
        .attr("stroke-dasharray", year === 2023 ? "6,3" : null)
        .attr("d", line)
        .attr("opacity", 0)
        .transition()
        .duration(600)
        .attr("opacity", 1);

        // Add dots for data points
        innerChart.selectAll(`.trend-points-${year}`)
        .data(yearData)
        .join("circle")
        .attr("class", `trend-points trend-points-${year}`)
        .attr("cx", v => getCenterX(v.ageGroup))
        .attr("cy", v => y(v.positiveValue))
        .attr("r", 5)
        .attr("fill", color(year))
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .style("cursor", "pointer")
        .on("mouseover", (event, v) => {
            tooltip.transition().duration(150).style("opacity", 1);
            tooltip.html(`
            <strong>Year:</strong> ${v.year}<br/>
            <strong>Age Group:</strong> ${v.ageGroup}<br/>
            <strong>Positive Tests:</strong> ${v.positiveValue.toLocaleString()}<br/>
            <strong>Rate:</strong> ${(v.positiveValue / v.totalTests * 100).toFixed(1)}%
            `);
        })
        .on("mousemove", (event) => {
            tooltip.style("left", (event.pageX + 12) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", () => tooltip.transition().duration(200).style("opacity", 0));
    });
    });

  });
};
