# Ambrus Csaszar (5/15/2014)

express = require "express"
http = require "http"
jade = require "jade"
fs = require "fs"
open = require "open"
path = require "path"

# Configure the app
app = express()
server = http.createServer(app)
app.use express.static __dirname
app.use (req, res, next) ->
  if req.is("text/*")
    req.text = ""
    req.setEncoding "utf8"
    req.on "data", (chunk) ->
      req.text += chunk
      return
    req.on "end", next
  else
    next()
  return
# Set up jade views
app.set "views", __dirname
app.set "view engine", "jade"
# GO
main = (->
  # Process args
  args = process.argv[2..]
  if args.length != 1
    throw new Error("todo-tracker requires a file to load")
  trackedFile = args[0]
  console.log "tracking", trackedFile
  # Read the file that we're tracking
  todoList = fs.readFileSync trackedFile,
    encoding: "utf8"
  console.log todoList
  # Serve the main page
  app.get "/", (req, res) ->
    res.render "main",
      fileName: path.basename(trackedFile)
      todoList: todoList
  # Handle file saving
  app.post "/save", (req, res) ->
    console.log "Save:"
    console.log req.text
    if req.text
      fs.writeFileSync trackedFile, req.text
    res.status 200
    res.end()
  # Run the server
  server.listen 0, ->
    console.log "Express server started", server.address()
  # Open a browser to the todo tracker
  open "http://localhost:" + server.address().port
)()
