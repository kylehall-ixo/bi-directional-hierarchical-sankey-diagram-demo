var OPACITY = {
  NODE_DEFAULT: 0.9,
  NODE_FADED: 0.1,
  NODE_HIGHLIGHT: 0.8,
  LINK_DEFAULT: 0.6,
  LINK_FADED: 0.05,
  LINK_HIGHLIGHT: 0.9
},
  LINK_COLOR = "#b3b3b3",
  INFLOW_COLOR = "#2E 86D1",
  OUTFLOW_COLOR = "#D63028",
  NODE_WIDTH = 36,
  COLLAPSER = {
    RADIUS: NODE_WIDTH / 2,
    SPACING: 2
  },
  OUTER_MARGIN = 10,
  MARGIN = {
    TOP: 2 * (COLLAPSER.RADIUS + OUTER_MARGIN),
    RIGHT: OUTER_MARGIN,
    BOTTOM: OUTER_MARGIN,
    LEFT: OUTER_MARGIN
  },
  TRANSITION_DURATION = 400,
  HEIGHT = 500 - MARGIN.TOP - MARGIN.BOTTOM,
  WIDTH = 960 - MARGIN.LEFT - MARGIN.RIGHT,
  LAYOUT_INTERATIONS = 32,
  REFRESH_INTERVAL = 7000;

function restoreLinksAndNodes() {
  link
    .style("stroke", LINK_COLOR)
    .style("marker-end", function () { return 'url(#arrowHead)'; })
    .transition()
    .duration(TRANSITION_DURATION)
    .style("opacity", OPACITY.LINK_DEFAULT);

  node
    .selectAll("rect")
    .style("fill", function (d) {
      d.color = colorScale(d.type.replace(/ .*/, ""));
      return d.color;
    })
    .style("stroke", function (d) {
      return d3.rgb(colorScale(d.type.replace(/ .*/, ""))).darker(0.1);
    })
    .style("fill-opacity", OPACITY.NODE_DEFAULT);

  node.filter(function (n) { return n.state === "collapsed"; })
    .transition()
    .duration(TRANSITION_DURATION)
    .style("opacity", OPACITY.NODE_DEFAULT);
}

function highlightConnected(g) {
  link.filter(function (d) { return d.source === g; })
    .style("marker-end", function () { return 'url(#arrowHeadInflow)'; })
    .style("stroke", OUTFLOW_COLOR)
    .style("opacity", OPACITY.LINK_DEFAULT);

  link.filter(function (d) { return d.target === g; })
    .style("marker-end", function () { return 'url(#arrowHeadOutlow)'; })
    .style("stroke", INFLOW_COLOR)
    .style("opacity", OPACITY.LINK_DEFAULT);
}

function fadeUnconnected(g) {
  link.filter(function (d) { return d.source !== g && d.target !== g; })
    .style("marker-end", function () { return 'url(#arrowHead)'; })
    .transition()
    .duration(TRANSITION_DURATION)
    .style("opacity", OPACITY.LINK_FADED);

  node.filter(function (d) {
    return (d.name === g.name) ? false : !biHiSankey.connected(d, g);
  }).transition()
    .duration(TRANSITION_DURATION)
    .style("opacity", OPACITY.NODE_FADED);
}

window.addEventListener('load', () => {
  var units = "Widgets";
  const formatNumber = d3.format(",.0f")    // zero decimal places
  const format = function (d) { return formatNumber(d) + " " + units; }
  const color = d3.scaleOrdinal(d3.schemeCategory10)

  const width = 500
  const height = 500

  const nodes = [
    { id: "Schulte Farms", name: "Schulte Farms" },
    { id: "Sandy River Farms", name: "Sandy River Farms" },
    { id: "McCune - Boar Power", name: "McCune - Boar Power" }
  ]

  const links = [
    { source: "Sandy River Farms", target: "Schulte Farms", value: 5 },
    { source: "Schulte Farms", target: "McCune - Boar Power", value: 10 }
  ]

  const sankey = d3.sankey()
    .nodeWidth(32)
    .nodePadding(290)
    .size([width + 100, height + 100])
    .nodeId(d => d.id)

  sankey.link = function () {
    var curvature = .5;

    function link(d) {
      console.dir(d)
      var x0 = d.source.x0 + d.source.dx,
        x1 = d.target.x1,
        xi = d3.interpolateNumber(x0, x1),
        x2 = xi(curvature),
        x3 = xi(1 - curvature),
        y0 = d.source.y0 + d.sy + d.dy / 2,
        y1 = d.target.y1 + d.ty + d.dy / 2;
      return "M" + x0 + "," + y0
        + "C" + x2 + "," + y0
        + " " + x3 + "," + y1
        + " " + x1 + "," + y1;
    }

    link.curvature = function (_) {
      if (!arguments.length) return curvature;
      curvature = +_;
      return link;
    };

    return link;
  }

  const graph = sankey({ nodes, links })

  const svg = d3.select("#diagram").append("svg")
    .attr("width", width)
    .attr("height", height)
    .append("g")

  defs = svg.append("defs")

  defs.append("marker")
    .style("fill", LINK_COLOR)
    .attr("id", "arrowHead")
    .attr("viewBox", "0 0 6 10")
    .attr("refX", "1")
    .attr("refY", "5")
    .attr("markerUnits", "strokeWidth")
    .attr("markerWidth", "1")
    .attr("markerHeight", "1")
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M 0 0 L 1 0 L 6 5 L 1 10 L 0 10 z")

  defs.append("marker")
    .style("fill", OUTFLOW_COLOR)
    .attr("id", "arrowHeadInflow")
    .attr("viewBox", "0 0 6 10")
    .attr("refX", "1")
    .attr("refY", "5")
    .attr("markerUnits", "strokeWidth")
    .attr("markerWidth", "1")
    .attr("markerHeight", "1")
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M 0 0 L 1 0 L 6 5 L 1 10 L 0 10 z")

  defs.append("marker")
    .style("fill", INFLOW_COLOR)
    .attr("id", "arrowHeadOutlow")
    .attr("viewBox", "0 0 6 10")
    .attr("refX", "1")
    .attr("refY", "5")
    .attr("markerUnits", "strokeWidth")
    .attr("markerWidth", "1")
    .attr("markerHeight", "1")
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M 0 0 L 1 0 L 6 5 L 1 10 L 0 10 z")

  const path = sankey.link()

  const link = svg.append("g").selectAll(".link")
    .data(graph.links)
    .enter().append("path")
    .attr("class", "link")
    .attr("d", path)
    .style("stroke-width", function (d) { return Math.max(1, d.dy); })
    .sort(function (a, b) { return b.dy - a.dy; })

  var node = svg.append("g").selectAll(".node")
    .data(graph.nodes)
    .enter().append("g")
    .attr("class", "node")
    .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; })

  node.transition()
    .duration(TRANSITION_DURATION)
    .style("opacity", OPACITY.NODE_DEFAULT)
    .select("rect")
    .style("fill", function (d) {
      d.color = colorScale(d.type.replace(/ .*/, ""));
      return d.color;
    })
    .style("stroke", function (d) { return d3.rgb(colorScale(d.type.replace(/ .*/, ""))).darker(0.1); })
    .style("stroke-WIDTH", "1px")
    .attr("height", function (d) { return d.height; })
    .attr("width", sankey.nodeWidth());

  node.append("rect")
    .attr("height", function (d) { return d.y1; })
    .attr("width", sankey.nodeWidth())
    .style("fill", function (d) {
      return d.color = color(d.name.replace(/ .*/, ""));
    })
    .style("stroke", function (d) {
      return d3.rgb(d.color).darker(2);
    })
    .append("title")
    .text(function (d) {
      return d.name + "\n" + format(d.value);
    })
})
