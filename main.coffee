
containerElm = null
inputElm = null
inputContainerElm = null
inputOverlayElm = null
hierElm = null
rawFileElm = null
warningsElm = null

fix_mobile_ie = ->
  if navigator.userAgent.match /IEMobile\/10\.0/
    msViewportStyle = document.createElement("style")
    msViewportStyle.appendChild(
      document.createTextNode "@-ms-viewport{width:auto!important}"
    )
    document.getElementsByTagName("head")[0].appendChild(msViewportStyle)

ensure = (condition, message) ->
  if not condition
    throw new Error(message)

Array.prototype.remove = (v) ->
  i = @indexOf(v)
  if i >= 0
    @splice(i, 1)


captureCompleted = (toks) ->
  completed = false
  if toks[0] == "x"
    completed = true
    toks = toks[1..]
  return [toks, completed]

capturePriority = (toks) ->
  t = toks[0]
  priority = null
  if t?.length == 3 and t[0] == '(' and t[2] == ')'
    priority = t[1]
    toks = toks[1..]
  else
    priTok = toks.filter (v,i,a) -> v.indexOf("pri:") == 0
    ensure(priTok.length <= 1, "multiple priority tokens found " + String(priTok))
    if priTok.length > 0
      priority = priTok[0][4..]
      toks.remove(priTok[0])
  return [toks, priority]

captureDate = (toks) ->
  dateTok = null
  year = month = day = null
  for t in toks
    dt = t.split('-')
    if dt.length == 3 and dt[0].length == 4 and dt[1].length == 2 and dt[2].length == 2
      try
        year = Number(dt[0])
        month = Number(dt[1])
        day = Number(dt[2])
        dateTok = t
        break
      catch e
  if dateTok
    toks.remove(dateTok)
    # return [toks, [year, month, day]]
    return [toks, dateTok]
  else
    return [toks, null]

captureWithPrefix = (toks, prefix) ->
  withPrefix = toks.filter (v,i,a) -> (v.indexOf(prefix) == 0 and v.length > prefix.length)
  prefixLen = prefix.length
  withPrefix = withPrefix.map (v,i,a) -> v[prefixLen..]
  toks = toks.filter (v,i,a) -> not (v.indexOf(prefix) == 0 and v.length > prefix.length)
  return [toks, withPrefix]

interpretLine = (line, lineNum) ->
  ensure("\n" not in line, "a single line must not contain newlines")
  toks = line.split(' ')
  # Remove all empty items
  toks = toks.filter (v,i,a) -> v.length
  # Create an item to return
  item =
    isCompleted: false
    priority: null
    startDate: null
    finishDate: null
    projects: []
    locations: []
    text: ""
    lineNum: lineNum
    line: line
  [toks, item.isCompleted] = captureCompleted(toks)
  if item.isCompleted
    [toks, item.finishDate] = captureDate(toks)
    [toks, item.startDate] = captureDate(toks)
    [toks, item.priority] = capturePriority(toks)
  else
    [toks, item.priority] = capturePriority(toks)
    [toks, item.startDate] = captureDate(toks)
  [toks, item.projects] = captureWithPrefix(toks, '+')
  [toks, item.locations] = captureWithPrefix(toks, '@')
  item.text = toks.join " "
  return item

class TaskTree
  constructor: (@onCreateLevel, @onAddItem) ->
    @itemsByNum = {}
    @tasks = []
  addItem: (item) ->
    level = this
    levelQuery = "#hierarchy"
    for l in item.projects
      if l not of level
        if @onCreateLevel
          @onCreateLevel levelQuery, l
        level[l] = { tasks: [] }
      levelQuery += " ." + l
      level = level[l]
    # console.log "adding", item.text, "to", level
    if @onAddItem
      @onAddItem levelQuery, item
    @itemsByNum[item.lineNum] = item
    level.tasks.push item
  getItem: (lineNum) ->
    return @itemsByNum[lineNum]

rebuildTree = (lines) ->
  hierElm.empty()
  tt = new TaskTree(
      (levelQuery, level) ->
        # Creates a level
        levelElm = $("<div class='level item " + level + "'><div class='heading item'>" + level + "</div></div>")
        $(levelQuery).append(levelElm)
      ,
      (levelQuery, item) ->
        # Adds an item to an existing level
        itemElm = taskTreeHtml item
        itemElm.on "click", (e) ->
          selectItem item.lineNum
        $(levelQuery).append itemElm
    )
  for l,i in lines
    if not l
      continue
    item = interpretLine(l,i)
    tt.addItem item
  return tt

selectedNum = null
taskIdFromNum = (taskNum) -> "#task-" + taskNum
taskNumFromId = (taskId) -> Number(taskId.split('-')[1])

getSibling = (node, isForward=true) ->
  if isForward then node.next() else node.prev()
getChildren = (node, isForward=true) ->
  ret = node.children().get()
  if isForward then ret else ret.reverse()

treeSearchNextLeaf = (node, leafSelector, validSelector, isForward) ->
  ensure(leafSelector, "leafSelector must be specified; was " + leafSelector)
  ensure(validSelector, "validSelector must be specified; was " + validSelector)
  ensure(isForward isnt undefined, "direction must be specified; was " + isForward)
  # Early-out on nonexistant nodes
  if not node
    return null
  # Recurse into the current node's children
  node = $(node)
  for n in getChildren(node, isForward)
    if $(n).is(leafSelector)
      return n
    leaf = treeSearchNextLeaf(n, leafSelector, validSelector, isForward)
    if leaf
      return leaf
  # Recurse into the current node's siblings
  sibling = getSibling(node, isForward).first()
  if sibling.length
    if sibling.is(leafSelector)
      return sibling[0]
    leaf = treeSearchNextLeaf(sibling, leafSelector, validSelector, isForward)
    if leaf
      return leaf
  # Traverse upwards through parents
  cur = node.parent()
  while getSibling(cur, isForward).length == 0
    if cur.length == 0
      return null
    cur = cur.parent()
  cur = getSibling(cur, isForward)
  if not cur.is(validSelector)
    return null
  if cur.is(leafSelector)
    return cur[0]
  return treeSearchNextLeaf(cur, leafSelector, validSelector, isForward)

taskTreeHtml = (task) ->
  taskElm = $("<div id='task-" + task.lineNum + "' class='level item task'></div>")
  if task.priority
    taskElm.append "(" + task.priority + ")"
  taskElm.append " " + task.text
  for loc in task.locations
    taskElm.append $("<span class='location'> @" + loc + "</span>")
  if task.isCompleted
    taskElm.addClass("completed")
  return taskElm

spanWrapText = (task, field, text) ->
  return text.replace task[field], "<span class='" + field + "'>" + task[field] + "</span>"

taskEditHtml = (task) ->
  taskElm = $("<span class='task-edit'></span>")
  text = task.line
  for p in task.projects
    p = "+" + p
    text = text.replace p, "<span class='project'>" + p + "</span>"
  for l in task.locations
    l = "@" + l
    text = text.replace l, "<span class='location'>" + l + "</span>"
  if task.isCompleted
    text = text.replace "x ", "<span class='isCompleted'>x </span>"
  if task.priority
    pri = "(" + task.priority + ")"
    text = text.replace pri, "<span class='priority'>(" + task.priority + ")</span>"
  text = spanWrapText(task, "startDate", text)
  text = spanWrapText(task, "finishDate", text)
  text = spanWrapText(task, "text", text)
  # text = text.replace(/\s/g, '\u00a0')
  taskElm.html text
  return taskElm

getSelectedItem = ->
  ensure(selectedNum isnt null, "something must be selected")
  return tt.getItem selectedNum

getSelectedElement = ->
  ensure(selectedNum isnt null, "something must be selected")
  return $(taskIdFromNum selectedNum).first()

selectItem = (taskNum) ->
  console.log "selecting", taskNum
  if selectedNum isnt null
    $(taskIdFromNum selectedNum).removeClass("selected")
  if taskNum isnt null
    selectedElm = $(taskIdFromNum taskNum).first()
    if selectedElm.length
      selectedElm.addClass("selected")
    else
      selectedNum = null
      throw new Error("Couldn't find item " + taskNum)
  selectedNum = taskNum

selectNext = (isForward) ->
  if selectedNum is null
    selectItem 0
  else
    selectedElm = getSelectedElement()
    next = treeSearchNextLeaf(selectedElm, ".task", ".item", isForward)
    if next
      return selectItem taskNumFromId next.id
    else
      console.log "at document boundary"

editCurrent = ->
  console.log "editing " + selectedNum
  ensure(selectedNum isnt null, "something must be selected")
  item = tt.getItem(selectedNum)
  ensure(item, "no item found for number " + selectedNum + "; item was " + item)
  setInputTask item
  selectedElm = getSelectedElement()
  inputContainerElm.show().css("top", selectedElm.position().top)
  inputElm.focus().caret(-1)

finishEdit = (commit) ->
  console.log "finishing edit of item " + selectedNum + "; commit is " + commit
  ensure(commit isnt undefined, "'commit' must be defined; was " + commit)
  ensure(selectedNum isnt null, "something must be selected")
  if commit
    replaceRawLine selectedNum, getInputText()
    triggerTreeUpdate()
  inputElm.empty()
  inputContainerElm.hide()
  containerElm.focus()

createNew = ->
  line = ""
  if selectedNum isnt null
    selectedItem = getSelectedItem()
    for p in selectedItem.projects
      line += "+" + p + " "
  addRawLine line
  triggerTreeUpdate()
  selectItem(countRawLines() - 1)
  editCurrent()

deleteCurrent = ->
  ensure(selectedNum isnt null, "something must be selected")
  selectedItem = getSelectedItem()
  if confirm("Delete '" + selectedItem.text[..40] + "'? THERE IS NO UNDO.") 
    replaceRawLine selectedNum, null
    prevSelectedNum = selectedNum
    selectItem null
    triggerTreeUpdate()
    selectItem Math.min prevSelectedNum, countRawLines() - 1

setInputTask = (task) ->
  inputElm.val task.line
  inputOverlayElm.html taskEditHtml task

getInputText = ->
  inputElm.val().replace(/\u00a0/g, ' ')

getInputTask = ->
  interpretLine getInputText(), selectedNum

replaceRawLine = (lineNum, line) ->
  ensure(lineNum isnt undefined, "Line number must be specified; was " + lineNum)
  rawFileElm = $("#raw-file")
  lines = rawFileElm.val().split('\n')
  lines[lineNum] = line
  lines = lines.filter (v,i,a) -> v
  rawFileElm.val lines.join('\n')

addRawLine = (line) ->
  rawText = rawFileElm.val()
  rawText += '\n' + line
  rawFileElm.val rawText

countRawLines = ->
  rawFileElm.val().split('\n').length

toggleComplete = ->
  console.log "toggling completion of item " + selectedNum
  ensure(selectedNum isnt null, "something must be selected")
  item = tt.getItem(selectedNum)
  ensure(item, "no item found for number " + selectedNum + "; item was " + item)
  if item.isCompleted
    replaceRawLine item.lineNum, item.line[2..]
  else
    replaceRawLine item.lineNum, "x " + item.line
  triggerTreeUpdate()

triggerTreeUpdate = ->
  $("#raw-file").trigger("input")
  selectItem selectedNum

syntaxHighlightEditor = ->
  inputTask = getInputTask()
  inputOverlayElm.html taskEditHtml inputTask

dbxChooseSuccess = (files) ->
  console.log files

dbxChooseCancel = ->
  console.log "chooser cancelled"

saveRawFile = ->
  currentVer = Math.random()
  ver = currentVer
  onSuccess = (data) ->
    if ver == currentVer
      warningsElm.empty()
      console.log data
      console.log "Saved."
      rawFileElm.prop "disabled", false
      hierElm.removeClass "disabled"
  onError = (xhr, status, thrown) ->
    warningsElm.text "COULDN'T SAVE (" + status + ") " + thrown
    rawFileElm.prop "disabled", true
    hierElm.addClass "disabled"
  console.log "Saving " + currentVer
  $.ajax(
      type: "POST"
      url: "save"
      data: rawFileElm.val()
      contentType: "text/plain"
      success: onSuccess
      error: onError
    )

tt = null
currentVer = 0
main = =>
  rawFileElm = $("#raw-file")
  containerElm = $("#hier-container")
  inputElm = $("#hier-input")
  inputContainerElm = $("#input-container")
  inputOverlayElm = $("#input-overlay")
  hierElm = $("#hierarchy")
  warningsElm = $(".warnings")

  # if window?.localStorage?.rawFile?
  #   rawFileElm.val(window.localStorage.rawFile)
  # rawFileElm.on "input", (e) ->
  #   # console.log "input", e, rawFileElm.val()
  #   window.localStorage.rawFile = rawFileElm.val().replace(/\u00a0/g, ' ')
  #   tt = rebuildTree rawFileElm.val().split('\n')
  #   # hierElm.text JSON.stringify(tt)

  rawFileElm.on "input", (e) ->
    tt = rebuildTree rawFileElm.val().split('\n')
    saveRawFile()

  tt = rebuildTree rawFileElm.val().split('\n')
  # hierElm.text JSON.stringify(tt)
  inputContainerElm.hide()
  containerElm.focus()

  inputElm.blur (e) ->
    finishEdit(false)

  inputElm.on "input", ->
    syntaxHighlightEditor()

  # Frob the item selection on keyboard arrows
  $(document).keydown (e) ->
    if containerElm.is(":focus") and not hierElm.hasClass("disabled") and e.which in [38, 40, 13, 46, 78, 88]
      e.preventDefault()
      switch e.which
        when 38 # Up Arrow
          selectNext(false)
        when 40 # Down Arrow
          selectNext(true)
        when 13 # Enter
          editCurrent()
        when 46 # Del
          deleteCurrent()
        when 78 # 'n'
          createNew()
        when 88 # 'x'
          toggleComplete()
    else if inputElm.is(":focus") and not hierElm.hasClass("disabled") and e.which in [13, 27]
      e.preventDefault()
      switch e.which
        when 13 # Enter
          finishEdit(true)
        when 27 # Escape
          finishEdit(false)
    # else
    #   console.log e.which

  $(document).keyup (e) ->
    # if inputElm.is(":focus")
    #   console.log "caret pos", inputElm.caret()

$ ->
  fix_mobile_ie()
  main()
