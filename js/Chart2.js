const drawChart2 = (data) => {
  const margin = { top: 60, right: 40, bottom: 60, left: 180 };
  const width = 900;
  const height = 500;

  // ----------------------------------------
  // 1. Data Preparation
  // ----------------------------------------
  const filtered = data.filter(d =>
    (d.year == 2023 || d.year == 2024) &&
    d.location && d.location.trim() !== ""
  );

  // Group totals by location
  const totals = d3.rollups(
    filtered,
    v => d3.sum(v, d => +d.count),
    d => d.location
  );

  // Group positives by location
  const positives = d3.rollups(
    filtered.filter(d => d.bestDetectionMethod?.toLowerCase() === "yes"),
    v => d3.sum(v, d => +d.count),
    d => d.location
  );

  // Merge both totals + positives
  const chartData = totals.map(([loc, total]) => {
    const positive = positives.find(([l]) => l === loc)?.[1] || 0;
    // compute dominant drug for this jurisdiction using rows where bestDetectionMethod === 'yes'
    const yesRows = filtered.filter(r => r.jurisdiction === loc && r.bestDetectionMethod?.toLowerCase() === 'yes');
    const drugFields = ['amphetamine','cannabis','cocaine','ecstasy','methylamphetamine','other','unknown'];
    const drugSums = {};
    drugFields.forEach(f => {
      drugSums[f] = d3.sum(yesRows, r => +r[f] || 0);
    });
    // find the max drug
    const maxEntry = Object.entries(drugSums).reduce((acc, cur) => cur[1] > acc[1] ? cur : acc, ['', 0]);
    const drugDisplay = {
      amphetamine: 'Amphetamine',
      cannabis: 'Cannabis',
      cocaine: 'Cocaine',
      ecstasy: 'Ecstasy',
      methylamphetamine: 'Methylamphetamine',
      other: 'Other',
      unknown: 'Unknown'
    };

    return {
      location: loc,
      total,
      positive,
      rate: total > 0 ? (positive / total) * 100 : 0,
      dominantDrugName: maxEntry[1] > 0 ? (drugDisplay[maxEntry[0]] || maxEntry[0]) : null,
      dominantDrugCount: maxEntry[1]
    };
  });

  // Sort descending by total tests
  chartData.sort((a, b) => b.total - a.total);

  // ----------------------------------------
  // 2. SVG Setup
  // ----------------------------------------
  const svg = d3.select("#chart2")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  const inner = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const tooltip = d3.select("#chart2")
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

  // ----------------------------------------
  // 3. Scales
  // ----------------------------------------
  const y0 = d3.scaleBand()
    .domain(chartData.map(d => d.location))
    .range([0, chartHeight])
    .paddingInner(0.3)
    .paddingOuter(0.1);

  const y1 = d3.scaleBand()
    .domain(["Total Tests", "Positive Tests"])
    .range([0, y0.bandwidth()])
    .padding(0.15);

  const x = d3.scaleLinear()
    .domain([0, d3.max(chartData, d => d.total) * 1.05])
    .range([0, chartWidth]);

  const color = d3.scaleOrdinal()
    .domain(["Total Tests", "Positive Tests"])
    .range(["#4e79a7", "#f28e2b"]);

  // ----------------------------------------
  // 4. Draw Bars
  // ----------------------------------------
  const groups = inner.selectAll(".group")
    .data(chartData)
    .join("g")
    .attr("class", "group")
    .attr("transform", d => `translate(0,${y0(d.location)})`);

  groups.selectAll("rect")
    .data(d => [
      { key: "Total Tests", value: d.total, rate: d.rate },
      { key: "Positive Tests", value: d.positive, rate: d.rate }
    ])
    .join("rect")
    .attr("y", d => y1(d.key))
    .attr("height", y1.bandwidth())
    .attr("width", d => x(d.value))
    .attr("fill", d => color(d.key))
    .attr("rx", 4)
    .attr("ry", 4)
    .style("cursor", "pointer")
    .on("mouseover", (event, d) => {
      tooltip.transition().duration(100).style("opacity", 1);
      tooltip.html(`
        <strong>${d.key}</strong><br/>
        Count: ${d.value.toLocaleString()}<br/>
        Positivity Rate: ${d.rate.toFixed(1)}%
      `);
    })
    .on("mousemove", (event) => {
      tooltip.style("left", event.pageX + 12 + "px")
             .style("top", event.pageY - 20 + "px");
    })
    .on("mouseout", () => tooltip.transition().duration(150).style("opacity", 0));

  // ----------------------------------------
  // 5. Axes
  // ----------------------------------------
  inner.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${chartHeight})`)
    .call(d3.axisBottom(x).ticks(6))
    .selectAll("text")
    .style("font-size", "12px");

  inner.append("g")
    .attr("class", "y-axis")
    .call(d3.axisLeft(y0))
    .selectAll("text")
    .style("font-size", "13px")
    .style("font-weight", "bold");

  // ----------------------------------------
  // 6. Legend
  // ----------------------------------------
  const legend = svg.append("g")
    .attr("transform", `translate(${width - 260}, ${margin.top})`);

  ["Total Tests", "Positive Tests"].forEach((label, i) => {
    legend.append("rect")
      .attr("x", 0)
      .attr("y", i * 25)
      .attr("width", 18)
      .attr("height", 18)
      .attr("fill", color(label));

    legend.append("text")
      .attr("x", 25)
      .attr("y", i * 25 + 13)
      .style("font-size", "13px")
      .text(label);
  });

  // ----------------------------------------
  // 7. Title
  // ----------------------------------------
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", margin.top / 2)
    .attr("text-anchor", "middle")
    .style("font-size", "18px")
    .style("font-weight", "bold")
    .text("Total Drug Tests vs Positive Detections by Location Type (2023–2024)");

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height - 15)
    .attr("text-anchor", "middle")
    .style("font-size", "13px")
    .text("Number of Tests Conducted");
};
