(function() {
  var TaskTree, addRawLine, captureCompleted, captureDate, capturePriority, captureWithPrefix, containerElm, countRawLines, createNew, currentVer, dbxChooseCancel, dbxChooseSuccess, deleteCurrent, editCurrent, ensure, finishEdit, fix_mobile_ie, getChildren, getInputTask, getInputText, getSelectedElement, getSelectedItem, getSibling, hierElm, inputContainerElm, inputElm, inputOverlayElm, interpretLine, main, rawFileElm, rebuildTree, replaceRawLine, saveRawFile, selectItem, selectNext, selectedNum, setInputTask, spanWrapText, syntaxHighlightEditor, taskEditHtml, taskIdFromNum, taskNumFromId, taskTreeHtml, toggleComplete, treeSearchNextLeaf, triggerTreeUpdate, tt, warningsElm,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  containerElm = null;

  inputElm = null;

  inputContainerElm = null;

  inputOverlayElm = null;

  hierElm = null;

  rawFileElm = null;

  warningsElm = null;

  fix_mobile_ie = function() {
    var msViewportStyle;
    if (navigator.userAgent.match(/IEMobile\/10\.0/)) {
      msViewportStyle = document.createElement("style");
      msViewportStyle.appendChild(document.createTextNode("@-ms-viewport{width:auto!important}"));
      return document.getElementsByTagName("head")[0].appendChild(msViewportStyle);
    }
  };

  ensure = function(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  };

  Array.prototype.remove = function(v) {
    var i;
    i = this.indexOf(v);
    if (i >= 0) {
      return this.splice(i, 1);
    }
  };

  captureCompleted = function(toks) {
    var completed;
    completed = false;
    if (toks[0] === "x") {
      completed = true;
      toks = toks.slice(1);
    }
    return [toks, completed];
  };

  capturePriority = function(toks) {
    var priTok, priority, t;
    t = toks[0];
    priority = null;
    if ((t != null ? t.length : void 0) === 3 && t[0] === '(' && t[2] === ')') {
      priority = t[1];
      toks = toks.slice(1);
    } else {
      priTok = toks.filter(function(v, i, a) {
        return v.indexOf("pri:") === 0;
      });
      ensure(priTok.length <= 1, "multiple priority tokens found " + String(priTok));
      if (priTok.length > 0) {
        priority = priTok[0].slice(4);
        toks.remove(priTok[0]);
      }
    }
    return [toks, priority];
  };

  captureDate = function(toks) {
    var dateTok, day, dt, e, month, t, year, _i, _len;
    dateTok = null;
    year = month = day = null;
    for (_i = 0, _len = toks.length; _i < _len; _i++) {
      t = toks[_i];
      dt = t.split('-');
      if (dt.length === 3 && dt[0].length === 4 && dt[1].length === 2 && dt[2].length === 2) {
        try {
          year = Number(dt[0]);
          month = Number(dt[1]);
          day = Number(dt[2]);
          dateTok = t;
          break;
        } catch (_error) {
          e = _error;
        }
      }
    }
    if (dateTok) {
      toks.remove(dateTok);
      return [toks, dateTok];
    } else {
      return [toks, null];
    }
  };

  captureWithPrefix = function(toks, prefix) {
    var prefixLen, withPrefix;
    withPrefix = toks.filter(function(v, i, a) {
      return v.indexOf(prefix) === 0 && v.length > prefix.length;
    });
    prefixLen = prefix.length;
    withPrefix = withPrefix.map(function(v, i, a) {
      return v.slice(prefixLen);
    });
    toks = toks.filter(function(v, i, a) {
      return !(v.indexOf(prefix) === 0 && v.length > prefix.length);
    });
    return [toks, withPrefix];
  };

  interpretLine = function(line, lineNum) {
    var item, toks, _ref, _ref1, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7;
    ensure(__indexOf.call(line, "\n") < 0, "a single line must not contain newlines");
    toks = line.split(' ');
    toks = toks.filter(function(v, i, a) {
      return v.length;
    });
    item = {
      isCompleted: false,
      priority: null,
      startDate: null,
      finishDate: null,
      projects: [],
      locations: [],
      text: "",
      lineNum: lineNum,
      line: line
    };
    _ref = captureCompleted(toks), toks = _ref[0], item.isCompleted = _ref[1];
    if (item.isCompleted) {
      _ref1 = captureDate(toks), toks = _ref1[0], item.finishDate = _ref1[1];
      _ref2 = captureDate(toks), toks = _ref2[0], item.startDate = _ref2[1];
      _ref3 = capturePriority(toks), toks = _ref3[0], item.priority = _ref3[1];
    } else {
      _ref4 = capturePriority(toks), toks = _ref4[0], item.priority = _ref4[1];
      _ref5 = captureDate(toks), toks = _ref5[0], item.startDate = _ref5[1];
    }
    _ref6 = captureWithPrefix(toks, '+'), toks = _ref6[0], item.projects = _ref6[1];
    _ref7 = captureWithPrefix(toks, '@'), toks = _ref7[0], item.locations = _ref7[1];
    item.text = toks.join(" ");
    return item;
  };

  TaskTree = (function() {
    function TaskTree(onCreateLevel, onAddItem) {
      this.onCreateLevel = onCreateLevel;
      this.onAddItem = onAddItem;
      this.itemsByNum = {};
      this.tasks = [];
    }

    TaskTree.prototype.addItem = function(item) {
      var l, level, levelQuery, _i, _len, _ref;
      level = this;
      levelQuery = "#hierarchy";
      _ref = item.projects;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        l = _ref[_i];
        if (!(l in level)) {
          if (this.onCreateLevel) {
            this.onCreateLevel(levelQuery, l);
          }
          level[l] = {
            tasks: []
          };
        }
        levelQuery += " ." + l;
        level = level[l];
      }
      if (this.onAddItem) {
        this.onAddItem(levelQuery, item);
      }
      this.itemsByNum[item.lineNum] = item;
      return level.tasks.push(item);
    };

    TaskTree.prototype.getItem = function(lineNum) {
      return this.itemsByNum[lineNum];
    };

    return TaskTree;

  })();

  rebuildTree = function(lines) {
    var i, item, l, tt, _i, _len;
    hierElm.empty();
    tt = new TaskTree(function(levelQuery, level) {
      var levelElm;
      levelElm = $("<div class='level item " + level + "'><div class='heading item'>" + level + "</div></div>");
      return $(levelQuery).append(levelElm);
    }, function(levelQuery, item) {
      var itemElm;
      itemElm = taskTreeHtml(item);
      itemElm.on("click", function(e) {
        return selectItem(item.lineNum);
      });
      return $(levelQuery).append(itemElm);
    });
    for (i = _i = 0, _len = lines.length; _i < _len; i = ++_i) {
      l = lines[i];
      if (!l) {
        continue;
      }
      item = interpretLine(l, i);
      tt.addItem(item);
    }
    return tt;
  };

  selectedNum = null;

  taskIdFromNum = function(taskNum) {
    return "#task-" + taskNum;
  };

  taskNumFromId = function(taskId) {
    return Number(taskId.split('-')[1]);
  };

  getSibling = function(node, isForward) {
    if (isForward == null) {
      isForward = true;
    }
    if (isForward) {
      return node.next();
    } else {
      return node.prev();
    }
  };

  getChildren = function(node, isForward) {
    var ret;
    if (isForward == null) {
      isForward = true;
    }
    ret = node.children().get();
    if (isForward) {
      return ret;
    } else {
      return ret.reverse();
    }
  };

  treeSearchNextLeaf = function(node, leafSelector, validSelector, isForward) {
    var cur, leaf, n, sibling, _i, _len, _ref;
    ensure(leafSelector, "leafSelector must be specified; was " + leafSelector);
    ensure(validSelector, "validSelector must be specified; was " + validSelector);
    ensure(isForward !== void 0, "direction must be specified; was " + isForward);
    if (!node) {
      return null;
    }
    node = $(node);
    _ref = getChildren(node, isForward);
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      n = _ref[_i];
      if ($(n).is(leafSelector)) {
        return n;
      }
      leaf = treeSearchNextLeaf(n, leafSelector, validSelector, isForward);
      if (leaf) {
        return leaf;
      }
    }
    sibling = getSibling(node, isForward).first();
    if (sibling.length) {
      if (sibling.is(leafSelector)) {
        return sibling[0];
      }
      leaf = treeSearchNextLeaf(sibling, leafSelector, validSelector, isForward);
      if (leaf) {
        return leaf;
      }
    }
    cur = node.parent();
    while (getSibling(cur, isForward).length === 0) {
      if (cur.length === 0) {
        return null;
      }
      cur = cur.parent();
    }
    cur = getSibling(cur, isForward);
    if (!cur.is(validSelector)) {
      return null;
    }
    if (cur.is(leafSelector)) {
      return cur[0];
    }
    return treeSearchNextLeaf(cur, leafSelector, validSelector, isForward);
  };

  taskTreeHtml = function(task) {
    var loc, taskElm, _i, _len, _ref;
    taskElm = $("<div id='task-" + task.lineNum + "' class='level item task'></div>");
    if (task.priority) {
      taskElm.append("(" + task.priority + ")");
    }
    taskElm.append(" " + task.text);
    _ref = task.locations;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      loc = _ref[_i];
      taskElm.append($("<span class='location'> @" + loc + "</span>"));
    }
    if (task.isCompleted) {
      taskElm.addClass("completed");
    }
    return taskElm;
  };

  spanWrapText = function(task, field, text) {
    return text.replace(task[field], "<span class='" + field + "'>" + task[field] + "</span>");
  };

  taskEditHtml = function(task) {
    var l, p, pri, taskElm, text, _i, _j, _len, _len1, _ref, _ref1;
    taskElm = $("<span class='task-edit'></span>");
    text = task.line;
    _ref = task.projects;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      p = _ref[_i];
      p = "+" + p;
      text = text.replace(p, "<span class='project'>" + p + "</span>");
    }
    _ref1 = task.locations;
    for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
      l = _ref1[_j];
      l = "@" + l;
      text = text.replace(l, "<span class='location'>" + l + "</span>");
    }
    if (task.isCompleted) {
      text = text.replace("x ", "<span class='isCompleted'>x </span>");
    }
    if (task.priority) {
      pri = "(" + task.priority + ")";
      text = text.replace(pri, "<span class='priority'>(" + task.priority + ")</span>");
    }
    text = spanWrapText(task, "startDate", text);
    text = spanWrapText(task, "finishDate", text);
    text = spanWrapText(task, "text", text);
    taskElm.html(text);
    return taskElm;
  };

  getSelectedItem = function() {
    ensure(selectedNum !== null, "something must be selected");
    return tt.getItem(selectedNum);
  };

  getSelectedElement = function() {
    ensure(selectedNum !== null, "something must be selected");
    return $(taskIdFromNum(selectedNum)).first();
  };

  selectItem = function(taskNum) {
    var selectedElm;
    console.log("selecting", taskNum);
    if (selectedNum !== null) {
      $(taskIdFromNum(selectedNum)).removeClass("selected");
    }
    if (taskNum !== null) {
      selectedElm = $(taskIdFromNum(taskNum)).first();
      if (selectedElm.length) {
        selectedElm.addClass("selected");
      } else {
        selectedNum = null;
        throw new Error("Couldn't find item " + taskNum);
      }
    }
    return selectedNum = taskNum;
  };

  selectNext = function(isForward) {
    var next, selectedElm;
    if (selectedNum === null) {
      return selectItem(0);
    } else {
      selectedElm = getSelectedElement();
      next = treeSearchNextLeaf(selectedElm, ".task", ".item", isForward);
      if (next) {
        return selectItem(taskNumFromId(next.id));
      } else {
        return console.log("at document boundary");
      }
    }
  };

  editCurrent = function() {
    var item, selectedElm;
    console.log("editing " + selectedNum);
    ensure(selectedNum !== null, "something must be selected");
    item = tt.getItem(selectedNum);
    ensure(item, "no item found for number " + selectedNum + "; item was " + item);
    setInputTask(item);
    selectedElm = getSelectedElement();
    inputContainerElm.show().css("top", selectedElm.position().top);
    return inputElm.focus().caret(-1);
  };

  finishEdit = function(commit) {
    console.log("finishing edit of item " + selectedNum + "; commit is " + commit);
    ensure(commit !== void 0, "'commit' must be defined; was " + commit);
    ensure(selectedNum !== null, "something must be selected");
    if (commit) {
      replaceRawLine(selectedNum, getInputText());
      triggerTreeUpdate();
    }
    inputElm.empty();
    inputContainerElm.hide();
    return containerElm.focus();
  };

  createNew = function() {
    var line, p, selectedItem, _i, _len, _ref;
    line = "";
    if (selectedNum !== null) {
      selectedItem = getSelectedItem();
      _ref = selectedItem.projects;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        p = _ref[_i];
        line += "+" + p + " ";
      }
    }
    addRawLine(line);
    triggerTreeUpdate();
    selectItem(countRawLines() - 1);
    return editCurrent();
  };

  deleteCurrent = function() {
    var prevSelectedNum, selectedItem;
    ensure(selectedNum !== null, "something must be selected");
    selectedItem = getSelectedItem();
    if (confirm("Delete '" + selectedItem.text.slice(0, 41) + "'? THERE IS NO UNDO.")) {
      replaceRawLine(selectedNum, null);
      prevSelectedNum = selectedNum;
      selectItem(null);
      triggerTreeUpdate();
      return selectItem(Math.min(prevSelectedNum, countRawLines() - 1));
    }
  };

  setInputTask = function(task) {
    inputElm.val(task.line);
    return inputOverlayElm.html(taskEditHtml(task));
  };

  getInputText = function() {
    return inputElm.val().replace(/\u00a0/g, ' ');
  };

  getInputTask = function() {
    return interpretLine(getInputText(), selectedNum);
  };

  replaceRawLine = function(lineNum, line) {
    var lines;
    ensure(lineNum !== void 0, "Line number must be specified; was " + lineNum);
    rawFileElm = $("#raw-file");
    lines = rawFileElm.val().split('\n');
    lines[lineNum] = line;
    lines = lines.filter(function(v, i, a) {
      return v;
    });
    return rawFileElm.val(lines.join('\n'));
  };

  addRawLine = function(line) {
    var rawText;
    rawText = rawFileElm.val();
    rawText += '\n' + line;
    return rawFileElm.val(rawText);
  };

  countRawLines = function() {
    return rawFileElm.val().split('\n').length;
  };

  toggleComplete = function() {
    var item;
    console.log("toggling completion of item " + selectedNum);
    ensure(selectedNum !== null, "something must be selected");
    item = tt.getItem(selectedNum);
    ensure(item, "no item found for number " + selectedNum + "; item was " + item);
    if (item.isCompleted) {
      replaceRawLine(item.lineNum, item.line.slice(2));
    } else {
      replaceRawLine(item.lineNum, "x " + item.line);
    }
    return triggerTreeUpdate();
  };

  triggerTreeUpdate = function() {
    $("#raw-file").trigger("input");
    return selectItem(selectedNum);
  };

  syntaxHighlightEditor = function() {
    var inputTask;
    inputTask = getInputTask();
    return inputOverlayElm.html(taskEditHtml(inputTask));
  };

  dbxChooseSuccess = function(files) {
    return console.log(files);
  };

  dbxChooseCancel = function() {
    return console.log("chooser cancelled");
  };

  saveRawFile = function() {
    var currentVer, onError, onSuccess, ver;
    currentVer = Math.random();
    ver = currentVer;
    onSuccess = function(data) {
      if (ver === currentVer) {
        warningsElm.empty();
        console.log(data);
        console.log("Saved.");
        rawFileElm.prop("disabled", false);
        return hierElm.removeClass("disabled");
      }
    };
    onError = function(xhr, status, thrown) {
      warningsElm.text("COULDN'T SAVE (" + status + ") " + thrown);
      rawFileElm.prop("disabled", true);
      return hierElm.addClass("disabled");
    };
    console.log("Saving " + currentVer);
    return $.ajax({
      type: "POST",
      url: "save",
      data: rawFileElm.val(),
      contentType: "text/plain",
      success: onSuccess,
      error: onError
    });
  };

  tt = null;

  currentVer = 0;

  main = (function(_this) {
    return function() {
      rawFileElm = $("#raw-file");
      containerElm = $("#hier-container");
      inputElm = $("#hier-input");
      inputContainerElm = $("#input-container");
      inputOverlayElm = $("#input-overlay");
      hierElm = $("#hierarchy");
      warningsElm = $(".warnings");
      rawFileElm.on("input", function(e) {
        tt = rebuildTree(rawFileElm.val().split('\n'));
        return saveRawFile();
      });
      tt = rebuildTree(rawFileElm.val().split('\n'));
      inputContainerElm.hide();
      containerElm.focus();
      inputElm.blur(function(e) {
        return finishEdit(false);
      });
      inputElm.on("input", function() {
        return syntaxHighlightEditor();
      });
      $(document).keydown(function(e) {
        var _ref, _ref1;
        if (containerElm.is(":focus") && !hierElm.hasClass("disabled") && ((_ref = e.which) === 38 || _ref === 40 || _ref === 13 || _ref === 46 || _ref === 78 || _ref === 88)) {
          e.preventDefault();
          switch (e.which) {
            case 38:
              return selectNext(false);
            case 40:
              return selectNext(true);
            case 13:
              return editCurrent();
            case 46:
              return deleteCurrent();
            case 78:
              return createNew();
            case 88:
              return toggleComplete();
          }
        } else if (inputElm.is(":focus") && !hierElm.hasClass("disabled") && ((_ref1 = e.which) === 13 || _ref1 === 27)) {
          e.preventDefault();
          switch (e.which) {
            case 13:
              return finishEdit(true);
            case 27:
              return finishEdit(false);
          }
        }
      });
      return $(document).keyup(function(e) {});
    };
  })(this);

  $(function() {
    fix_mobile_ie();
    return main();
  });

}).call(this);
