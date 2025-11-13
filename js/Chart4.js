function drawChart4(data, geoData, selectedYear = 2024) {
  d3.select("#chart4").selectAll("*").remove(); 
  const width = 900;
  const height = 700;
  const svg = d3.select("#chart4").append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const tooltip = d3.select("#chart4").append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("background", "rgba(255,255,255,0.95)")
    .style("border", "1px solid #ccc")
    .style("border-radius", "6px")
    .style("padding", "8px 40px")
    .style("font-size", "13px")
    .style("pointer-events", "none")
    .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)")
    .style("opacity", 0);

  const projection = d3.geoMercator()
    .center([134, -28])
    .scale(800)
    .translate([width / 2, height / 2]); 

  const path = d3.geoPath().projection(projection);
  const roadsideDrugs = ["AMPHETAMINE", "CANNABIS", "ECSTASY"];

  const filtered = data.filter(
    d => +d.year >= 2023 && 
    d.bestDetectionMethod?.toLowerCase() === "yes"
  );

  const grouped = d3.rollup(
    filtered,
    v => {
      const totals = {};
      roadsideDrugs.forEach(drug => {
        totals[drug] = d3.sum(v, d =>
          d[drug.toLowerCase()]?.trim().toLowerCase() === "yes" ? +d.count : 0
        );
      });
      const dominantDrug = roadsideDrugs.reduce((a, b) =>
        totals[a] > totals[b] ? a : b
      );
      totals.total = d3.sum(Object.values(totals));
      totals.dominantDrug = dominantDrug;
      return totals;
    },
    d => d.jurisdiction.trim().toLowerCase()
  );

  const jurisdictionMap = {
    "nsw": "new south wales",
    "vic": "victoria",
    "qld": "queensland",
    "wa": "western australia",
    "sa": "south australia",
    "tas": "tasmania",
    "nt": "northern territory",
    "act": "australian capital territory"
  };

  const normalizedGrouped = new Map();
  grouped.forEach((val, key) => {
    const full = jurisdictionMap[key.toLowerCase()] || key;
    normalizedGrouped.set(full, val);
  });

  const color = d3.scaleOrdinal()
    .domain(roadsideDrugs)
    .range(["#4CAF50", "#FF7043", "#42A5F5"]);
  // modern styling + interaction
  const defs = svg.append('defs');
  defs.append('filter').attr('id', 'shadow')
    .append('feDropShadow')
    .attr('dx', 0).attr('dy', 1).attr('stdDeviation', 2)
    .attr('flood-color', '#000').attr('flood-opacity', 0.12);

  const defaultFill = '#f4f6f8';
  const stateStroke = '#c9d3d9';

  // Draw map states; tag each path with a lowercase normalized name for lookups
const states = svg.selectAll('path')
  .data(geoData.features)
  .join('path')
  .attr('d', path)
  .attr('fill', d => {
    const name = (d.properties.STATE_NAME || d.properties.STE_NAME16 || d.properties.name || '').trim().toLowerCase();
    const stats = normalizedGrouped.get(name);
    // fill the entire state with its dominant drug color when data exists
    return stats && stats.total > 0 ? color(stats.dominantDrug) : defaultFill;
  })
  .attr('stroke', stateStroke)
  .attr('stroke-width', 0.8)
  .style('filter', 'url(#shadow)')
  .style('cursor', 'pointer')
  .each(function(d) {
    const name = (d.properties.STATE_NAME || d.properties.STE_NAME16 || d.properties.name || '').trim().toLowerCase();
    d3.select(this).attr('data-name', name);
  });

  // helper to sanitize id names
  const idFor = s => 'grad-' + s.replace(/[^a-z0-9]+/gi, '-');

  function createGradientFor(name, stats) {
    const gid = idFor(name);
    defs.select(`#${gid}`).remove();
    const grad = defs.append('linearGradient').attr('id', gid).attr('x1', '0%').attr('y1', '0%').attr('x2', '100%').attr('y2', '0%');
    const totals = stats.total || 0;
    if (!totals) {
      grad.append('stop').attr('offset', '0%').attr('stop-color', defaultFill);
      grad.append('stop').attr('offset', '100%').attr('stop-color', defaultFill);
      return `url(#${gid})`;
    }
    // accumulate segments for each drug
    let cum = 0;
    roadsideDrugs.forEach(drug => {
      const v = stats[drug] || 0;
      if (v <= 0) return;
      const start = cum;
      cum += v / totals;
      const end = cum;
      const startPct = (start * 100).toFixed(2) + '%';
      const endPct = (end * 100).toFixed(2) + '%';
      const c = color(drug);
      grad.append('stop').attr('offset', startPct).attr('stop-color', c);
      grad.append('stop').attr('offset', endPct).attr('stop-color', c);
    });
    if (cum < 1) {
      const cumPct = (cum * 100).toFixed(2) + '%';
      grad.append('stop').attr('offset', cumPct).attr('stop-color', defaultFill);
      grad.append('stop').attr('offset', '100%').attr('stop-color', defaultFill);
    }
    return `url(#${gid})`;
  }

  // Add hover effects for modern interaction
  states.on('mouseenter', function(event, d) {
    const name = (d.properties.STATE_NAME || d.properties.STE_NAME16 || d.properties.name || '').trim().toLowerCase();
    const stats = normalizedGrouped.get(name);
    
    // If this state is not currently selected, highlight on hover
    if (selected !== name) {
      d3.select(this)
        .transition().duration(200)
        .attr('stroke-width', 2.5)
        .attr('stroke', '#333');
      
      // Show subtle hover tooltip with jurisdiction name
      if (stats && stats.total > 0) {
        tooltip.transition().duration(100).style('opacity', 0.7);
        tooltip.html(`<strong>${d.properties.STATE_NAME}</strong><br/><em>Click to explore</em>`);
        tooltip.style('left', (event.pageX + 12) + 'px').style('top', (event.pageY - 20) + 'px');
      }
    }
  })
  .on('mouseleave', function(event, d) {
    const name = (d.properties.STATE_NAME || d.properties.STE_NAME16 || d.properties.name || '').trim().toLowerCase();
    
    // If not selected, restore stroke
    if (selected !== name) {
      d3.select(this)
        .transition().duration(200)
        .attr('stroke-width', 0.8)
        .attr('stroke', stateStroke);
      
      tooltip.transition().duration(100).style('opacity', 0);
    }
  });

  // clicking a state toggles proportional fill and shows animated statistics
  let selected = null;
  states.on('click', function(event, d) {
    const name = (d.properties.STATE_NAME || d.properties.STE_NAME16 || d.properties.name || '').trim().toLowerCase();
    const stats = normalizedGrouped.get(name);
    const stateName = d.properties.STATE_NAME;
    
    // hide tooltip if clicking same
    if (selected === name) {
      selected = null;
      // reset all states to their original dominant drug color
      states.transition().duration(400)
        .attr('fill', d => {
          const nm = (d.properties.STATE_NAME || d.properties.STE_NAME16 || d.properties.name || '').trim().toLowerCase();
          const s = normalizedGrouped.get(nm);
          return s && s.total > 0 ? color(s.dominantDrug) : defaultFill;
        })
        .attr('stroke', stateStroke)
        .attr('stroke-width', 0.8);
      tooltip.transition().duration(200).style('opacity', 0);
      // Clear dynamic legend on deselect
      svg.select('#dynamicLegend').remove();
      // Clear statistics panel
      svg.select('#statsPanel').remove();
      return;
    }
    
    selected = name;
    // turn all others grey with smooth transition
    states.transition().duration(300)
      .attr('fill', d => {
        const nm = (d.properties.STATE_NAME || d.properties.STE_NAME16 || d.properties.name || '').trim().toLowerCase();
        return nm === name ? null : '#e0e0e0';  // Keep selected as-is, grey others
      })
      .attr('stroke', d => {
        const nm = (d.properties.STATE_NAME || d.properties.STE_NAME16 || d.properties.name || '').trim().toLowerCase();
        return nm === name ? '#333' : stateStroke;
      })
      .attr('stroke-width', d => {
        const nm = (d.properties.STATE_NAME || d.properties.STE_NAME16 || d.properties.name || '').trim().toLowerCase();
        return nm === name ? 2 : 0.8;
      });
    
    if (stats && stats.total > 0) {
      const gUrl = createGradientFor(name, stats);
      d3.select(this).transition().duration(600).attr('fill', gUrl);
      
      // Create animated statistics panel below map
      svg.select('#statsPanel').remove(); // Clear previous
      const statsPanel = svg.append('g')
        .attr('id', 'statsPanel')
        .attr('transform', `translate(${width / 2 - 320}, ${height - 140})`);
      
      // Semi-transparent rounded background for stats
      statsPanel.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 360)
        .attr('height', 85)
        .attr('fill', 'rgba(255, 255, 255, 0.97)')
        .attr('stroke', '#bbb')
        .attr('stroke-width', 1.5)
        .attr('rx', 8)
        .attr('ry', 8)
        .style('filter', 'url(#shadow)');
      
      // Title with animation
      const titleText = statsPanel.append('text')
        .attr('x', 180)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .style('font-size', '15px')
        .style('font-weight', 'bold')
        .style('fill', '#333')
        .style('opacity', 0)
        .text(`${stateName} — Statistics`);
      
      titleText.transition().duration(400).delay(100).style('opacity', 1);
      
      // Total count with animation
      const totalText = statsPanel.append('text')
        .attr('x', 180)
        .attr('y', 42)
        .attr('text-anchor', 'middle')
        .style('font-size', '13px')
        .style('fill', '#555')
        .style('opacity', 0)
        .text(`Total Positive Tests: ${stats.total.toLocaleString()}`);
      
      totalText.transition().duration(400).delay(150).style('opacity', 1);
      
      // Drug breakdown items
      roadsideDrugs.forEach((drug, i) => {
        const count = stats[drug] || 0;
        const pct = stats.total ? (count / stats.total * 100).toFixed(1) : '0.0';
        
        // Circular legend dots instead of squares
        const circleGroup = statsPanel.append('g')
          .attr('transform', `translate(${30 + i * 110}, 65)`)
          .style('opacity', 0);
        
        // Circular swatch
        circleGroup.append('circle')
          .attr('cx', 0)
          .attr('cy', 0)
          .attr('r', 7)
          .attr('fill', color(drug))
          .attr('stroke', '#333')
          .attr('stroke-width', 1);
        
        // Drug name and percentage
        circleGroup.append('text')
          .attr('x', 14)
          .attr('y', 4)
          .style('font-size', '11px')
          .style('font-weight', '500')
          .text(`${drug}`);
        
        circleGroup.append('text')
          .attr('x', 14)
          .attr('y', 15)
          .style('font-size', '10px')
          .style('fill', '#666')
          .text(`${pct}%`);
        
        // Animate each drug item in sequence
        circleGroup.transition().duration(300).delay(200 + i * 100).style('opacity', 1);
      });
      
      // Drug breakdown is now shown in the statistics panel only (no separate legend)
    } else {
      d3.select(this).transition().duration(300).attr('fill', '#eceff1').attr('stroke', '#666');
      tooltip.transition().duration(150).style('opacity', 0);
      
      // Show "no data" notification panel instead of nothing
      svg.select('#statsPanel').remove();
      const noDataPanel = svg.append('g')
        .attr('id', 'statsPanel')
        .attr('transform', `translate(${width / 2 - 320}, ${height - 140})`);
      
      // Semi-transparent rounded background for notification
      noDataPanel.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 360)
        .attr('height', 85)
        .attr('fill', 'rgba(255, 255, 255, 0.97)')
        .attr('stroke', '#ddd')
        .attr('stroke-width', 1.5)
        .attr('rx', 8)
        .attr('ry', 8)
        .style('filter', 'url(#shadow)');
      
      // Title with animation
      const noDataTitle = noDataPanel.append('text')
        .attr('x', 180)
        .attr('y', 25)
        .attr('text-anchor', 'middle')
        .style('font-size', '15px')
        .style('font-weight', 'bold')
        .style('fill', '#ff9800')
        .style('opacity', 0)
        .text(`${stateName}`);
      
      noDataTitle.transition().duration(400).delay(100).style('opacity', 1);
      
      // No data message with animation
      const noDataMsg = noDataPanel.append('text')
        .attr('x', 180)
        .attr('y', 50)
        .attr('text-anchor', 'middle')
        .style('font-size', '13px')
        .style('fill', '#999')
        .style('opacity', 0)
        .text('No data available for this jurisdiction');
      
      noDataMsg.transition().duration(400).delay(150).style('opacity', 1);
      
      // Helpful hint with animation
      const noDataHint = noDataPanel.append('text')
        .attr('x', 180)
        .attr('y', 68)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px')
        .style('fill', '#bbb')
        .style('font-style', 'italic')
        .style('opacity', 0)
        .text('(Data prior to 2021 unavailable. NT data limited.)');
      
      noDataHint.transition().duration(400).delay(200).style('opacity', 1);
    }
  });

  svg.selectAll(".state-label")
    .data(geoData.features)
    .join("text")
    .attr("class", "state-label")
    .attr("transform", d => `translate(${path.centroid(d)})`)
    .attr("text-anchor", "middle")
    .attr("alignment-baseline", "middle")
    .style("font-size", "12px")
    .style("font-weight", "bold")
    .style("fill", "#000")
    .style("pointer-events", "none")
    .text(d => d.properties.STATE_NAME || d.properties.name);

  // Create a legend group (hidden initially, shown on click with statistics)
  const legend = svg.append("g")
    .attr("transform", `translate(${width / 2 - 120}, ${height - 80})`)
    .attr('id', 'dynamicLegend')
    .style('display', 'none')
    .style('background', 'rgba(255,255,255,0.9)')
    .style('padding', '10px')
    .style('border-radius', '4px')
    .style('border', '1px solid #ccc');

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", 30)
    .attr("text-anchor", "middle")
    .style("font-size", "18px")
    .style("font-weight", "bold")
    .text(`Dominant Roadside Drug Detections by Jurisdiction (${selectedYear})`);

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height - 10)
    .attr("text-anchor", "middle")
    .style("font-size", "11px")
    .style("fill", "#555")
    .text("Note: Data prior to 2021 and NT data (2023–2024) unavailable due to data quality issues. NSW confirmatory testing discontinued since Sept 2024.");
  }

// Add dropdown listener
d3.select("#yearSelect").on("change", function() {
  const selectedYear = this.value;
  drawChart4(data, geoData, selectedYear);
});
