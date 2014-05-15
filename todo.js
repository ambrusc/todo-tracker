(function() {
  var app, express, fs, http, jade, main, open, path, server;

  express = require("express");

  http = require("http");

  jade = require("jade");

  fs = require("fs");

  open = require("open");

  path = require("path");

  app = express();

  server = http.createServer(app);

  app.use(express["static"](__dirname));

  app.use(function(req, res, next) {
    if (req.is("text/*")) {
      req.text = "";
      req.setEncoding("utf8");
      req.on("data", function(chunk) {
        req.text += chunk;
      });
      req.on("end", next);
    } else {
      next();
    }
  });

  app.set("views", __dirname);

  app.set("view engine", "jade");

  main = (function() {
    var args, todoList, trackedFile;
    args = process.argv.slice(2);
    if (args.length !== 1) {
      throw new Error("todo-tracker requires a file to load");
    }
    trackedFile = args[0];
    console.log("tracking", trackedFile);
    todoList = fs.readFileSync(trackedFile, {
      encoding: "utf8"
    });
    console.log(todoList);
    app.get("/", function(req, res) {
      return res.render("main", {
        fileName: path.basename(trackedFile),
        todoList: todoList
      });
    });
    app.post("/save", function(req, res) {
      console.log("Save:");
      console.log(req.text);
      if (req.text) {
        fs.writeFileSync(trackedFile, req.text);
      }
      res.status(200);
      return res.end();
    });
    server.listen(0, function() {
      return console.log("Express server started", server.address());
    });
    return open("http://localhost:" + server.address().port);
  })();

}).call(this);
