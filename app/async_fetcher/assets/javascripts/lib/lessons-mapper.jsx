//= require ../vendor/d3
//= require ../vendor/dagre-d3

CodeLab.LessonsMapper = class {
  constructor(containerID, lessons, userData={approvedLessonKeys: ['static-laptop-setup']}) {
    this.containerID = containerID
    this.lessons = lessons
    this.userData = userData

    this.evaluateForUser()
    this.initializeGraph()
    this.draw = this.draw.bind(this)
  }

  evaluateForUser() {
    this.approvedLessonKeys = this.lessons
      .filter(lesson => lesson.status === 'approved')
      .map(lesson => lesson.key)

    const lessonKeyIsApproved = (key) => {
      return this.approvedLessonKeys.indexOf(key) > -1
    }

    const lessonIsRecommended = (lesson) => {
      return !lessonKeyIsApproved(lesson.key) &&
             lesson.prereqs.every(lessonKeyIsApproved)
    }

    this.recommendedLessonKeys = this.lessons
      .filter(lessonIsRecommended)
      .map(lesson => lesson.key)
  }

  initializeGraph() {
    this.graph = new dagreD3.graphlib.Graph().setGraph({
      nodesep: 10,
      rankdir: 'LR',
      edgesep: 0,
      ranksep: 100,
      marginx: 5,
      marginy: 5
    }).setDefaultEdgeLabel(() => { return {} })

    this.lessons.forEach(lesson => {
      this.graph.setNode(lesson.key, {
        label: lesson.languages[0] ? lesson.languages[0].toUpperCase() : '...',
        width: 32,
        height: 32,
        shape: 'circle',
        lesson: lesson,
        // Necessary to set here for dagre-d3 to correctly center labels
        labelStyle: 'font-weight: 300; font-size: 14;'
      })
    })

    this.lessons.forEach(lesson => {
      lesson.prereqs && lesson.prereqs.forEach(prereqKey => {
        this.graph.setEdge(prereqKey, lesson.key, {
          lineInterpolate: 'bundle'
        })
      })
    })

    this.renderer = new dagreD3.render()
  }

  draw() {
    document.getElementById(this.containerID).innerHTML = ''
    this.drawSVGContainer()
    this.enablePanning()
    this.computeAndDrawLayout()
    this.customizeGraph()
  }

  drawSVGContainer() {
    this.containerWidth = document.getElementById(this.containerID).offsetWidth
    this.svg = d3.select('#' + this.containerID).append('svg')
      .attr('width', this.containerWidth)

    this.svgInner = this.svg.append('g')
  }

  enablePanning() {
    const zoomed = () => {
      let drawWidth = d3.select('g.nodes')[0][0].getBBox().width
      let minX = d3.min([0, this.containerWidth - 10 - drawWidth])
      let maxX = d3.max([this.containerWidth - 10 - drawWidth, 0])
      let newX = d3.min([d3.max([d3.event.translate[0], minX]), maxX])
      zoomer.translate([newX, 0])
      this.svgInner.attr('transform', `translate(${newX},0)`)
    }

    const zoomer = d3.behavior.zoom()
      .scaleExtent([1, 1])
      .on('zoom', zoomed)

    this.svg.call(zoomer)

    // Disable mousewheel zoom
    this.svg.on('wheel.zoom', null)
    this.svg.on('mousewheel.zoom', null)

    this.svg.attr('class', 'grabbable')
  }

  computeAndDrawLayout() {
    this.renderer(d3.select('svg g'), this.graph)
    this.svg.attr('height', this.graph.graph().height)
  }

  customizeGraph() {
    const nodes = this.svg.selectAll('g.node')

    nodes.attr('class', key => {
      const lesson = this.graph.node(key).lesson
      let classes = [
        'node',
        lesson.languages[0],
        lesson.status
      ]
      this.recommendedLessonKeys.indexOf(key) > -1 && classes.push('recommended')
      return classes.join(' ')
    })

    const circleStrokeWidth = (key, isHovered=false) => {
      const baseWidth = this.recommendedLessonKeys.indexOf(key) > -1 ? 5 : 2
      if (this.approvedLessonKeys.indexOf(key) > -1) return baseWidth
      return isHovered ? baseWidth + 3 : baseWidth
    }

    nodes.select('circle')
      .attr('class', 'lesson')
      .attr('data-content', key => this.graph.node(key).lesson.title)
      .style('transition', 'stroke-width 0.3s')
      .style('cursor', 'pointer')
      .style('stroke-width', key => circleStrokeWidth(key))
      .on('mouseover', function(key) {
        d3.select(this).style('stroke-width', circleStrokeWidth(key, true))
      })
      .on('mouseout', function(key) {
        d3.select(this).style('stroke-width', circleStrokeWidth(key))
      })
      .on('click', key => {
        location.assign(`/lessons/${key}`)
      })

    nodes.select('g.label text')
      .style('pointer-events', 'none')

    nodes.each(function(key) {
      const node = d3.select(this)

      if (node.classed('approved')) {
        node.append('circle')
          .attr('class', 'overlay')
          .attr('r', 28)
          .style('fill', 'rgba(255,255,255,0.7)')
          .style('pointer-events', 'none')

        node.append('text')
          .text('✓')
          .attr('dy', 15)
          .attr('text-anchor', 'middle')
          .attr('font-size', '40px')
          .attr('fill', 'rgba(34,139,34,0.6)')
          .style('pointer-events', 'none')
      }
    })

    $(`#${this.containerID} svg circle`).popover({
      container: '#' + this.containerID,
      placement: 'right',
      animation: false,
      trigger: 'hover'
    })

    const edges = this.svg.selectAll('g.edgepath')

    edges.select('path')
      .style('stroke-width', 2)
  }
}