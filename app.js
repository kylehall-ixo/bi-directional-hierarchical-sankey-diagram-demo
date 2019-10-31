'use strict';

var svg, tooltip, biHiSankey, path, defs, colorScale, highlightColorScale, isTransitioning;

var OPACITY = {
  NODE_DEFAULT: 0.9,
  NODE_FADED: 0.1,
  NODE_HIGHLIGHT: 0.8,
  LINK_DEFAULT: 0.6,
  LINK_FADED: 0.05,
  LINK_HIGHLIGHT: 0.9
},
  TYPES = ["Asset", "Expense", "Revenue", "Equity", "Liability"],
  TYPE_COLORS = ["#1b9e77", "#d95f02", "#7570b3", "#e7298a", "#66a61e", "#e6ab02", "#a6761d"],
  TYPE_HIGHLIGHT_COLORS = ["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3", "#a6d854", "#ffd92f", "#e5c494"],
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

// Used when temporarily disabling user interractions to allow animations to complete
var disableUserInterractions = function (time) {
  isTransitioning = true;
  setTimeout(function () {
    isTransitioning = false;
  }, time);
},

  hideTooltip = function () {
    return tooltip.transition()
      .duration(TRANSITION_DURATION)
      .style("opacity", 0);
  },

  showTooltip = function () {
    return tooltip
      .style("left", d3.event.pageX + "px")
      .style("top", d3.event.pageY + 15 + "px")
      .transition()
      .duration(TRANSITION_DURATION)
      .style("opacity", 1);
  };

colorScale = d3.scale.ordinal().domain(TYPES).range(TYPE_COLORS),
  highlightColorScale = d3.scale.ordinal().domain(TYPES).range(TYPE_HIGHLIGHT_COLORS),

  svg = d3.select("#chart").append("svg")
    .attr("width", WIDTH + MARGIN.LEFT + MARGIN.RIGHT)
    .attr("height", HEIGHT + MARGIN.TOP + MARGIN.BOTTOM)
    .append("g")
    .attr("transform", "translate(" + MARGIN.LEFT + "," + MARGIN.TOP + ")");

svg.append("g").attr("id", "links");
svg.append("g").attr("id", "nodes");
svg.append("g").attr("id", "collapsers");

tooltip = d3.select("#chart").append("div").attr("id", "tooltip");

tooltip.style("opacity", 0)
  .append("p")
  .attr("class", "value");

biHiSankey = d3.biHiSankey();

// Set the biHiSankey diagram properties
biHiSankey
  .nodeWidth(NODE_WIDTH)
  .nodeSpacing(10)
  .linkSpacing(4)
  .arrowheadScaleFactor(0.5) // Specifies that 0.5 of the link's stroke WIDTH should be allowed for the marker at the end of the link.
  .size([WIDTH, HEIGHT]);

path = biHiSankey.link().curvature(0.45);

defs = svg.append("defs");

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
  .attr("d", "M 0 0 L 1 0 L 6 5 L 1 10 L 0 10 z");

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
  .attr("d", "M 0 0 L 1 0 L 6 5 L 1 10 L 0 10 z");

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
  .attr("d", "M 0 0 L 1 0 L 6 5 L 1 10 L 0 10 z");

function update() {
  var link, linkEnter, node, nodeEnter, collapser, collapserEnter;

  function dragmove(node) {
    node.x = Math.max(0, Math.min(WIDTH - node.width, d3.event.x));
    node.y = Math.max(0, Math.min(HEIGHT - node.height, d3.event.y));
    d3.select(this).attr("transform", "translate(" + node.x + "," + node.y + ")");
    biHiSankey.relayout();
    svg.selectAll(".node").selectAll("rect").attr("height", function (d) { return d.height; });
    link.attr("d", path);
  }

  function containChildren(node) {
    node.children.forEach(function (child) {
      child.state = "contained";
      child.parent = this;
      child._parent = null;
      containChildren(child);
    }, node);
  }

  function expand(node) {
    node.state = "expanded";
    node.children.forEach(function (child) {
      child.state = "collapsed";
      child._parent = this;
      child.parent = null;
      containChildren(child);
    }, node);
  }

  function collapse(node) {
    node.state = "collapsed";
    containChildren(node);
  }

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

  function showHideChildren(node) {
    disableUserInterractions(2 * TRANSITION_DURATION);
    hideTooltip();
    if (node.state === "collapsed") { expand(node); }
    else { collapse(node); }

    biHiSankey.relayout();
    update();
    link.attr("d", path);
    restoreLinksAndNodes();
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

  link = svg.select("#links").selectAll("path.link")
    .data(biHiSankey.visibleLinks(), function (d) { return d.id; });

  link.transition()
    .duration(TRANSITION_DURATION)
    .style("stroke-WIDTH", function (d) { return Math.max(1, d.thickness); })
    .attr("d", path)
    .style("opacity", OPACITY.LINK_DEFAULT);


  link.exit().remove();


  linkEnter = link.enter().append("path")
    .attr("class", "link")
    .style("fill", "none");

  linkEnter.on('mouseenter', function (d) {
    if (!isTransitioning) {
      showTooltip().select(".value").text(function () {
        console.log(`source name: ${d.source.name}`)
        const sourceTitle = d.source.name.indexOf("-") >= 0 ? d.source.name.split("-")[0] : d.source.name
        const targetTitle = d.target.name.indexOf("-") >= 0 ? d.target.name.split("-")[0] : d.target.name

        if (d.direction > 0) {
          return sourceTitle + " → " + targetTitle;
        }
        return targetTitle + " ← " + sourceTitle;
      });

      d3.select(this)
        .style("stroke", LINK_COLOR)
        .transition()
        .duration(TRANSITION_DURATION / 2)
        .style("opacity", OPACITY.LINK_HIGHLIGHT);
    }
  });

  linkEnter.on('mouseleave', function () {
    if (!isTransitioning) {
      hideTooltip();

      d3.select(this)
        .style("stroke", LINK_COLOR)
        .transition()
        .duration(TRANSITION_DURATION / 2)
        .style("opacity", OPACITY.LINK_DEFAULT);
    }
  });

  linkEnter.sort(function (a, b) { return b.thickness - a.thickness; })
    .classed("leftToRight", function (d) {
      return d.direction > 0;
    })
    .classed("rightToLeft", function (d) {
      return d.direction < 0;
    })
    .style("marker-end", function () {
      return 'url(#arrowHead)';
    })
    .style("stroke", LINK_COLOR)
    .style("opacity", 0)
    .transition()
    .delay(TRANSITION_DURATION)
    .duration(TRANSITION_DURATION)
    .attr("d", path)
    .style("stroke-WIDTH", function (d) { return Math.max(1, d.thickness); })
    .style("opacity", OPACITY.LINK_DEFAULT);


  node = svg.select("#nodes").selectAll(".node")
    .data(biHiSankey.collapsedNodes(), function (d) { return d.id; });


  node.transition()
    .duration(TRANSITION_DURATION)
    .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; })
    .style("opacity", OPACITY.NODE_DEFAULT)
    .select("rect")
    .style("fill", function (d) {
      d.color = colorScale(d.type.replace(/ .*/, ""));
      return d.color;
    })
    .style("stroke", function (d) { return d3.rgb(colorScale(d.type.replace(/ .*/, ""))).darker(0.1); })
    .style("stroke-WIDTH", "1px")
    .attr("height", function (d) { return d.height; })
    .attr("width", biHiSankey.nodeWidth());


  node.exit()
    .transition()
    .duration(TRANSITION_DURATION)
    .attr("transform", function (d) {
      var collapsedAncestor, endX, endY;
      collapsedAncestor = d.ancestors.filter(function (a) {
        return a.state === "collapsed";
      })[0];
      endX = collapsedAncestor ? collapsedAncestor.x : d.x;
      endY = collapsedAncestor ? collapsedAncestor.y : d.y;
      return "translate(" + endX + "," + endY + ")";
    })
    .remove();


  nodeEnter = node.enter().append("g").attr("class", "node");

  nodeEnter
    .attr("transform", function (d) {
      var startX = d._parent ? d._parent.x : d.x,
        startY = d._parent ? d._parent.y : d.y;
      return "translate(" + startX + "," + startY + ")";
    })
    .style("opacity", 1e-6)
    .transition()
    .duration(TRANSITION_DURATION)
    .style("opacity", OPACITY.NODE_DEFAULT)
    .attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });

  nodeEnter.append("text");
  nodeEnter.append("rect")
    .style("fill", function (d) {
      d.color = colorScale(d.type.replace(/ .*/, ""));
      return d.color;
    })
    .style("stroke", function (d) {
      return d3.rgb(colorScale(d.type.replace(/ .*/, ""))).darker(0.1);
    })
    .style("stroke-WIDTH", "1px")
    .attr("height", function (d) { return d.height * 2; })
    .attr("width", biHiSankey.nodeWidth());

  node.on("mouseenter", function (g) {
    if (!isTransitioning) {
      restoreLinksAndNodes();
      highlightConnected(g);
      fadeUnconnected(g);

      d3.select(this).select("rect")
        .style("fill", function (d) {
          d.color = d.netFlow > 0 ? INFLOW_COLOR : OUTFLOW_COLOR;
          return d.color;
        })
        .style("stroke", function (d) {
          return d3.rgb(d.color).darker(0.1);
        })
        .style("fill-opacity", OPACITY.LINK_DEFAULT);

      tooltip
        .style("left", g.x + MARGIN.LEFT + "px")
        .style("top", g.y + g.height + MARGIN.TOP + 15 + "px")
        .transition()
        .duration(TRANSITION_DURATION)
        .style("opacity", 1).select(".value")
        .text(function () {
          const title = g.name.indexOf("-") >= 0 ? g.name.split("-")[0] : g.name
          var additionalInstructions = g.children.length ? "\n(Double click to expand)" : "";
          return title + additionalInstructions;
        });
    }
  });

  node.on("mouseleave", function () {
    if (!isTransitioning) {
      hideTooltip();
      restoreLinksAndNodes();
    }
  });

  node.filter(function (d) { return d.children.length; })
    .on("dblclick", showHideChildren);

  // allow nodes to be dragged to new positions
  node.call(d3.behavior.drag()
    .origin(function (d) { return d; })
    .on("dragstart", function () { this.parentNode.appendChild(this); })
    .on("drag", dragmove));

  // add in the text for the nodes
  node.filter(function (d) { return d.value !== 0; })
    .select("text")
    .attr("x", -6)
    .attr("y", function (d) { return d.height / 2; })
    .attr("dy", ".35em")
    .attr("text-anchor", "end")
    .attr("transform", null)
    .text(function (d) {
      const title = d.name.indexOf("-") >= 0 ? d.name.split("-")[0] : d.name
      return title
    })
    .filter(function (d) { return d.x < WIDTH / 2; })
    .attr("x", 6 + biHiSankey.nodeWidth())
    .attr("text-anchor", "start");


  collapser = svg.select("#collapsers").selectAll(".collapser")
    .data(biHiSankey.expandedNodes(), function (d) { return d.id; });


  collapserEnter = collapser.enter().append("g").attr("class", "collapser");

  collapserEnter.append("circle")
    .attr("r", COLLAPSER.RADIUS)
    .style("fill", function (d) {
      d.color = colorScale(d.type.replace(/ .*/, ""));
      return d.color;
    });

  collapserEnter
    .style("opacity", OPACITY.NODE_DEFAULT)
    .attr("transform", function (d) {
      return "translate(" + (d.x + d.width / 2) + "," + (d.y + COLLAPSER.RADIUS) + ")";
    });

  collapserEnter.on("dblclick", showHideChildren);

  collapser.select("circle")
    .attr("r", COLLAPSER.RADIUS);

  collapser.transition()
    .delay(TRANSITION_DURATION)
    .duration(TRANSITION_DURATION)
    .attr("transform", function (d, i) {
      return "translate("
        + (COLLAPSER.RADIUS + i * 2 * (COLLAPSER.RADIUS + COLLAPSER.SPACING))
        + ","
        + (-COLLAPSER.RADIUS - OUTER_MARGIN)
        + ")";
    });

  collapser.on("mouseenter", function (g) {
    if (!isTransitioning) {
      showTooltip().select(".value")
        .text(function () {
          return g.name + "\n(Double click to collapse)";
        });

      var highlightColor = highlightColorScale(g.type.replace(/ .*/, ""));

      d3.select(this)
        .style("opacity", OPACITY.NODE_HIGHLIGHT)
        .select("circle")
        .style("fill", highlightColor);

      node.filter(function (d) {
        return d.ancestors.indexOf(g) >= 0;
      }).style("opacity", OPACITY.NODE_HIGHLIGHT)
        .select("rect")
        .style("fill", highlightColor);
    }
  });

  collapser.on("mouseleave", function (g) {
    if (!isTransitioning) {
      hideTooltip();
      d3.select(this)
        .style("opacity", OPACITY.NODE_DEFAULT)
        .select("circle")
        .style("fill", function (d) { return d.color; });

      node.filter(function (d) {
        return d.ancestors.indexOf(g) >= 0;
      }).style("opacity", OPACITY.NODE_DEFAULT)
        .select("rect")
        .style("fill", function (d) { return d.color; });
    }
  });

  collapser.exit().remove();

}

var exampleNodes = [
  { "type": "Schulte Farms", "id": "a", "parent": null, "name": "Schulte Farms" },
  { "type": "Schulte Farms", "id": 1, "parent": "a", "number": "101", "name": "Feeder Pig Mixed-1" },
  { "type": "Schulte Farms", "id": 2, "parent": "a", "number": "120", "name": "Feeder Pig Mixed-2" },
  { "type": "Schulte Farms", "id": 3, "parent": "a", "number": "140", "name": "Feeder Pig Mixed-3" },
  { "type": "Schulte Farms", "id": 4, "parent": "a", "number": "150", "name": "Feeder Pig Mixed-4" },
  { "type": "Schulte Farms", "id": 5, "parent": "a", "number": "160", "name": "Feeder Pig Mixed-5" },
  { "type": "Schulte Farms", "id": 6, "parent": "a", "number": "170", "name": "Feeder Pig Mixed-6" },
  { "type": "Schulte Farms", "id": 7, "parent": "a", "number": "175", "name": "Feeder Pig Mixed-7" },
  { "type": "Schulte Farms", "id": 8, "parent": "a", "number": "178", "name": "Feeder Pig Mixed-8" },
  { "type": "Schulte Farms", "id": 9, "parent": "a", "number": "180", "name": "Feeder Pig Mixed-9" },
  { "type": "Schulte Farms", "id": 10, "parent": "a", "number": "188", "name": "Feeder Pig Mixed-10" },
  { "type": "Sandy River Farms", "id": "l", "parent": null, "number": "l", "name": "Sandy River Farms" },
  { "type": "Sandy River Farms", "id": 11, "parent": "l", "number": "210", "name": "Feeder Pig Mixed-11" },
  { "type": "Sandy River Farms", "id": 12, "parent": "l", "number": "215", "name": "Feeder Pig Mixed-12" },
  { "type": "Sandy River Farms", "id": 13, "parent": "l", "number": "220", "name": "Feeder Pig Mixed-13" },
  { "type": "Sandy River Farms", "id": 14, "parent": "l", "number": "230", "name": "Feeder Pig Mixed-14" },
  { "type": "Sandy River Farms", "id": 15, "parent": "l", "number": "240", "name": "Feeder Pig Mixed-15" },
  { "type": "Sandy River Farms", "id": 16, "parent": "l", "number": "250", "name": "Feeder Pig Mixed-16" },
  { "type": "Nathan Hill", "id": "eq", "parent": null, "number": "eq", "name": "Nathan Hill" },
  { "type": "Balloun Farms", "id": "r", "parent": null, "number": "r", "name": "Balloun Farms" },
  { "type": "Balloun Farms", "id": "or", "parent": "r", "number": "", "name": "Feeder Pig Mixed-or" },
  { "type": "Balloun Farms", "id": 17, "parent": "or", "number": "310", "name": "Feeder Pig Mixed-17" },
  { "type": "Balloun Farms", "id": "nor", "parent": "r", "number": "", "name": "Feeder Pig Mixed-nor" },
  { "type": "Balloun Farms", "id": 18, "parent": "nor", "number": "810", "name": "Feeder Pig Mixed-18" },
  { "type": "Balloun Farms", "id": 19, "parent": "nor", "number": "910", "name": "Feeder Pig Mixed-19" },
  { "type": "Balloun Farms", "id": 20, "parent": "nor", "number": "960", "name": "Feeder Pig Mixed-20" },
  { "type": "Price Farms", "id": "ex", "parent": null, "number": "ex", "name": "Price Farms" },
  { "type": "Price Farms", "id": 21, "parent": "ex", "number": "500", "name": "Feeder Pig Mixed-21" },
  { "type": "Price Farms", "id": 22, "parent": "ex", "number": "510", "name": "Feeder Pig Mixed-22" },
  { "type": "Price Farms", "id": 23, "parent": "ex", "number": "540", "name": "Feeder Pig Mixed-23" },
  { "type": "Price Farms", "id": 24, "parent": "ex", "number": "560", "name": "Feeder Pig Mixed-24" },
  { "type": "Price Farms", "id": 25, "parent": "ex", "number": "570", "name": "Feeder Pig Mixed-25" },
  { "type": "Price Farms", "id": 26, "parent": "ex", "number": "576", "name": "Feeder Pig Mixed-26" },
  { "type": "Price Farms", "id": 27, "parent": "ex", "number": "610", "name": "Feeder Pig Mixed-27" },
  { "type": "Price Farms", "id": 28, "parent": "ex", "number": "750", "name": "Feeder Pig Mixed-28" },
  { "type": "C&H Farms", "id": "c", "parent": null, "number": "850", "name": "C&H Farms" },
  { "type": "C&H Farms", "id": 29, "parent": "c", "number": "850", "name": "Feeder Pig Mixed-29" },
  { "type": "C&H Farms", "id": 30, "parent": "c", "number": "850", "name": "Feeder Pig Mixed-30" },
  { "type": "C&H Farms", "id": 31, "parent": "c", "number": "850", "name": "Feeder Pig Mixed-31" },
  { "type": "C&H Farms", "id": 32, "parent": "c", "number": "850", "name": "Feeder Pig Mixed-32" },
  { "type": "C&H Farms", "id": 33, "parent": "c", "number": "850", "name": "Feeder Pig Mixed-33" },
  { "type": "C&H Farms", "id": 34, "parent": "c", "number": "850", "name": "Feeder Pig Mixed-34" },
  { "type": "Ronald Hunter", "id": 35, "parent": null, "number": "850", "name": "Ronald Hunter" },
]

const exampleLinks = [
  { "source": 8, "target": 28, "value": Math.floor(Math.random() * 400) },
  { "source": 16, "target": 35, "value": Math.floor(Math.random() * 400) },
  { "source": 29, "target": 3, "value": Math.floor(Math.random() * 100) },
  { "source": 34, "target": 6, "value": Math.floor(Math.random() * 700) },
  { "source": 32, "target": 10, "value": Math.floor(Math.random() * 100) },
  { "source": 32, "target": 9, "value": Math.floor(Math.random() * 100) },
  { "source": 9, "target": 27, "value": Math.floor(Math.random() * 100) },
  { "source": 3, "target": 21, "value": Math.floor(Math.random() * 100) },
  { "source": 17, "target": 8, "value": Math.floor(Math.random() * 100) },
  { "source": 17, "target": 6, "value": Math.floor(Math.random() * 600) },
  { "source": 6, "target": 23, "value": Math.floor(Math.random() * 600) },
  { "source": 17, "target": 4, "value": Math.floor(Math.random() * 800) },
  { "source": 29, "target": 2, "value": Math.floor(Math.random() * 100) },
  { "source": 2, "target": 22, "value": Math.floor(Math.random() * 100) },
  { "source": 4, "target": 24, "value": Math.floor(Math.random() * 690) },
  { "source": 10, "target": 24, "value": Math.floor(Math.random() * 100) },
  { "source": 15, "target": 24, "value": Math.floor(Math.random() * 100) },
  { "source": 26, "target": 28, "value": Math.floor(Math.random() * 100) },
  { "source": 22, "target": 24, "value": Math.floor(Math.random() * 100) },
  { "source": 3, "target": 28, "value": Math.floor(Math.random() * 800) },
  { "source": 5, "target": 25, "value": Math.floor(Math.random() * 100) },
  { "source": 33, "target": 5, "value": Math.floor(Math.random() * 100) },
  { "source": 25, "target": 28, "value": Math.floor(Math.random() * 100) },
  { "source": 10, "target": 21, "value": Math.floor(Math.random() * 900) },
  { "source": 14, "target": 23, "value": Math.floor(Math.random() * 100) },
  { "source": 16, "target": 24, "value": Math.floor(Math.random() * 110) },
  { "source": 22, "target": 28, "value": Math.floor(Math.random() * 100) },
  { "source": 8, "target": 21, "value": Math.floor(Math.random() * 100) },
  { "source": "eq", "target": 12, "value": Math.floor(Math.random() * 200) },
  { "source": "eq", "target": 12, "value": Math.floor(Math.random() * 600) },
  { "source": "eq", "target": 1, "value": Math.floor(Math.random() * 100) },
  { "source": "eq", "target": 4, "value": Math.floor(Math.random() * 900) },
  { "source": "eq", "target": 7, "value": Math.floor(Math.random() * 200) },
  { "source": 7, "target": 27, "value": Math.floor(Math.random() * 200) },
  { "source": 1, "target": 21, "value": Math.floor(Math.random() * 100) },
  { "source": 1, "target": 24, "value": Math.floor(Math.random() * 350) },
]

biHiSankey
  .nodes(exampleNodes)
  .links(exampleLinks)
  .initializeNodes(function (node) {
    node.state = node.parent ? "contained" : "collapsed";
  })
  .layout(LAYOUT_INTERATIONS);

disableUserInterractions(2 * TRANSITION_DURATION);

update();
