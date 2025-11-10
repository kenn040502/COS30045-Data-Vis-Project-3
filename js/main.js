// main.js
const state = {
  data: [],
  jurisdiction: "All",
  year: "All",
  drug: "All"
};

const width = 500;
const height = 280;
const margin = { top: 30, right: 20, bottom: 40, left: 55 };

d3.csv("data/cleanedData.csv").then(raw => {
  // coerce
  raw.forEach(d => {
    d.year = +d.year;
    d.positive_count = +d.positive_count || 0;
  });

  state.data = raw;

  initControls(raw);
  renderAll();
});

function initControls(data) {
  // jurisdictions
  const jurs = Array.from(new Set(data.map(d => d.jurisdiction))).sort();
  const jurSel = d3.select("#jurisdictionSelect");
  jurSel.append("option").attr("value", "All").text("All");
  jurSel.selectAll("option.jur")
    .data(jurs)
    .enter()
    .append("option")
    .attr("class", "jur")
    .attr("value", d => d)
    .text(d => d);

  jurSel.on("change", e => {
    state.jurisdiction = e.target.value;
    renderAll();
  });

  // years
  const years = Array.from(new Set(data.map(d => d.year))).sort((a, b) => a - b);
  const yearSel = d3.select("#yearSelect");
  yearSel.append("option").attr("value", "All").text("All");
  yearSel.selectAll("option.yr")
    .data(years)
    .enter()
    .append("option")
    .attr("class", "yr")
    .attr("value", d => d)
    .text(d => d);

  yearSel.on("change", e => {
    state.year = e.target.value;
    renderAll();
  });

  // drug types
  const drugs = Array.from(new Set(data.map(d => d.drug_type))).filter(Boolean).sort();
  const drugSel = d3.select("#drugSelect");
  drugSel.selectAll("option.drug")
    .data(drugs)
    .enter()
    .append("option")
    .attr("class", "drug")
    .attr("value", d => d)
    .text(d => d);

  drugSel.on("change", e => {
    state.drug = e.target.value;
    renderAll();
  });
}

function filteredData() {
  return state.data.filter(d => {
    const jurOK = state.jurisdiction === "All" || d.jurisdiction === state.jurisdiction;
    const yearOK = state.year === "All" || d.year === +state.year;
    const drugOK = state.drug === "All" || d.drug_type === state.drug;
    return jurOK && yearOK && drugOK;
  });
}

function renderAll() {
  const data = filteredData();
  renderTrend(state.data, state.jurisdiction, state.drug); // trend should ignore year filter
  renderAge(data);
  renderMethod(data);
  renderLocations(data);
}

function renderTrend(data, jur, drug) {
  // group by year (optionally by jur & drug)
  let trendData = d3.rollups(
    data.filter(d => (jur === "All" || d.jurisdiction === jur) && (drug === "All" || d.drug_type === drug)),
    v => d3.sum(v, d => d.positive_count),
    d => d.year
  ).map(([year, total]) => ({ year, total }))
   .sort((a, b) => a.year - b.year);

  const svg = d3.select("#trendChart")
    .attr("width", width)
    .attr("height", height);

  svg.selectAll("*").remove();

  const x = d3.scaleLinear()
    .domain(d3.extent(trendData, d => d.year))
    .range([margin.left, width - margin.right]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(trendData, d => d.total) || 1])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const line = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.total));

  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x).tickFormat(d3.format("d")));

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  svg.append("path")
    .datum(trendData)
    .attr("fill", "none")
    .attr("stroke", "#0E7C7B")
    .attr("stroke-width", 2)
    .attr("d", line);

  svg.selectAll("circle.point")
    .data(trendData)
    .enter()
    .append("circle")
    .attr("class", "point")
    .attr("cx", d => x(d.year))
    .attr("cy", d => y(d.total))
    .attr("r", 4)
    .attr("fill", "#0E7C7B")
    .append("title")
    .text(d => `${d.year}: ${d.total.toLocaleString()}`);
}

function renderAge(data) {
  // group by age_group
  const grouped = d3.rollups(
    data,
    v => d3.sum(v, d => d.positive_count),
    d => d.age_group
  ).map(([age_group, total]) => ({ age_group, total }))
   .filter(d => d.age_group && d.age_group !== "All ages")
   .sort((a, b) => d3.ascending(a.age_group, b.age_group));

  const svg = d3.select("#ageChart")
    .attr("width", width)
    .attr("height", height);

  svg.selectAll("*").remove();

  const x = d3.scaleBand()
    .domain(grouped.map(d => d.age_group))
    .range([margin.left, width - margin.right])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([0, d3.max(grouped, d => d.total) || 1])
    .nice()
    .range([height - margin.bottom, margin.top]);

  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x));

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  svg.selectAll("rect.bar")
    .data(grouped)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.age_group))
    .attr("y", d => y(d.total))
    .attr("width", x.bandwidth())
    .attr("height", d => (height - margin.bottom) - y(d.total))
    .attr("fill", "#F39237")
    .append("title")
    .text(d => `${d.age_group}: ${d.total.toLocaleString()}`);
}

function renderMethod(data) {
  const grouped = d3.rollups(
    data,
    v => d3.sum(v, d => d.positive_count),
    d => d.detection_method
  ).map(([detection_method, total]) => ({ detection_method, total }))
   .filter(d => d.detection_method);

  const svg = d3.select("#methodChart")
    .attr("width", width)
    .attr("height", height);

  svg.selectAll("*").remove();

  const x = d3.scaleBand()
    .domain(grouped.map(d => d.detection_method))
    .range([margin.left, width - margin.right])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([0, d3.max(grouped, d => d.total) || 1])
    .nice()
    .range([height - margin.bottom, margin.top]);

  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x));

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

  svg.selectAll("rect.method")
    .data(grouped)
    .enter()
    .append("rect")
    .attr("class", "method")
    .attr("x", d => x(d.detection_method))
    .attr("y", d => y(d.total))
    .attr("width", x.bandwidth())
    .attr("height", d => (height - margin.bottom) - y(d.total))
    .attr("fill", "#E94F37")
    .append("title")
    .text(d => `${d.detection_method}: ${d.total.toLocaleString()}`);
}

function renderLocations(data) {
  // top 10 locations
  const grouped = d3.rollups(
    data,
    v => d3.sum(v, d => d.positive_count),
    d => d.location
  ).map(([location, total]) => ({ location, total }))
   .filter(d => d.location)
   .sort((a, b) => d3.descending(a.total, b.total))
   .slice(0, 10);

  const list = d3.select("#locationList");
  list.selectAll("*").remove();

  grouped.forEach(d => {
    list.append("li").text(`${d.location}: ${d.total.toLocaleString()}`);
  });
}
