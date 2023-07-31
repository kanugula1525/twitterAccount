const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const format = require("date-fns/format");
const isValid = require("date-fns/isValid");
const app = express();
app.use(express.json());
module.exports = app;

let db = null;
const dbPath = path.join(__dirname, "todoApplication.db");

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const validateRequestData = async (request, response, next) => {
  // this middle wear is created for retrieve the data from query and params.
  const { id, search_q, todo, status, priority, category } = request.query;

  const { todoId } = request.params;
  const statusArray = ["TO DO", "IN PROGRESS", "DONE"];
  const priorityArray = ["HIGH", "MEDIUM", "LOW"];
  const categoryArray = [`WORK`, `HOME`, `LEARNING`];

  if (status !== undefined) {
    // status validation
    const isValidStatus = await statusArray.includes(status);
    if (isValidStatus) {
      request.status = status;
    } else {
      response.status(400);
      response.send("Invalid Todo Status");
      return;
    }
  }

  if (priority !== undefined) {
    // priority validation
    const isValidPriority = await priorityArray.includes(priority);
    if (isValidPriority) {
      request.priority = priority;
    } else {
      response.status(400);
      response.send("Invalid Todo Priority");
      return;
    }
  }

  if (category !== undefined) {
    // category validation
    const isValidCategory = await categoryArray.includes(category);
    if (isValidCategory) {
      request.category = category;
    } else {
      response.status(400);
      response.send("Invalid Todo Category");
      return;
    }
  }

  request.id = id;
  request.todoId = todoId;
  request.todo = todo;
  request.search_q = search_q;
  next();
};

// API 1 //
app.get("/todos/", validateRequestData, async (request, response) => {
  const { priority = "", status = "", category = "", search_q = "" } = request;
  const { todoId } = request;
  const getDetailsOfTodo = `
SELECT id,todo,priority,status,category,due_date as dueDate
FROM todo
WHERE priority LIKE '%${priority}%' AND status LIKe '%${status}%' AND
category LIKE '%${category}%' AND todo LIKE '%${search_q}%'
`;
  const dbResponse = await db.all(getDetailsOfTodo);
  response.send(dbResponse);
});

// API 2 //
app.get("/todos/:todoId/", validateRequestData, async (request, response) => {
  const { todoId } = request;
  const getTodo = `
        SELECT id,todo,priority,status,category,due_date AS dueDate FROM todo WHERE id = ${todoId};`;
  const dbResponse = await db.get(getTodo);
  response.send(dbResponse);
});

// API 3 //
app.get("/agenda/", async (request, response) => {
  const { date } = request.query;

  if (date === undefined) {
    response.status(400);
    response.send("Invalid Due Date");
  } else {
    const isValidDate = isValid(new Date(date));
    if (isValidDate) {
      const formattedDate = format(new Date(date), "yyyy-MM-dd");
      const getQuery = `
      SELECT id,todo,priority,status,category,due_date AS dueDate 
      FROM todo WHERE due_date='${formattedDate}';`;
      const todos = await db.all(getQuery);
      response.send(todos);
    } else {
      response.status(400);
      response.send("Invalid Due Date");
      return;
    }
  }
});

// API 4 //
app.post("/todos/", async (request, response) => {
  let { id, todo, priority, status, category, dueDate } = request.body;

  if (status !== undefined) {
    // status validation
    const statusArray = ["TO DO", "IN PROGRESS", "DONE"];
    const isValidStatus = await statusArray.includes(status);
    if (isValidStatus) {
      status = status;
    } else {
      status = undefined;
      response.status(400);
      response.send("Invalid Todo Status");
      return;
    }
  }
  if (priority !== undefined) {
    // priority validation
    const priorityArray = ["HIGH", "MEDIUM", "LOW"];
    const isValidPriority = await priorityArray.includes(priority);
    if (isValidPriority) {
      priority = priority;
    } else {
      priority = undefined;
      response.status(400);
      response.send("Invalid Todo Priority");
      return;
    }
  }

  if (category !== undefined) {
    // category validation
    const categoryArray = [`WORK`, `HOME`, `LEARNING`];
    const isValidCategory = await categoryArray.includes(category);
    if (isValidCategory) {
      category = category;
    } else {
      category = undefined;
      response.status(400);
      response.send("Invalid Todo Category");
      return;
    }
  }

  if (dueDate !== undefined) {
    const isValidDate = await isValid(new Date(dueDate));
    if (isValidDate) {
      const modifiedDate = format(new Date(dueDate), "yyyy-MM-dd");
      dueDate = modifiedDate;
    } else {
      dueDate = undefined;
      response.status(400);
      response.send("Invalid Due Date");
      return;
    }
  } else {
    response.status(400);
    response.send("Invalid Due Date");
    return;
  }
  if (
    status !== undefined &&
    priority !== undefined &&
    category !== undefined &&
    dueDate !== undefined
  ) {
    const postTodo = `
    INSERT INTO todo(id,todo,priority,status,category,due_date)
    Values(
        ${id},
        '${todo}',
        '${priority}',
        '${status}',
        '${category}',
        '${dueDate}');`;
    const dbResponse = await db.run(postTodo);
    response.send("Todo Successfully Added");
  }
});

// API 5 //
app.put("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const { todo, category, priority, status, dueDate } = request.body;
  switch (true) {
    // scenario 1
    case status !== undefined:
      const statusArray = ["TO DO", "IN PROGRESS", "DONE"];
      const isValidStatus = await statusArray.includes(status);
      if (isValidStatus) {
        const updateStatus = ` UPDATE todo SET status='${status}' WHERE id = ${todoId};`;
        await db.run(updateStatus);
        response.send("Status Updated");
      } else {
        response.status(400);
        response.send("Invalid Todo Status");
      }
      break;

    // scenario 2
    case priority !== undefined:
      const priorityArray = ["HIGH", "MEDIUM", "LOW"];
      const isValidPriority = await priorityArray.includes(priority);
      if (isValidPriority) {
        const updatePriority = `
        UPDATE todo
        SET
        priority='${priority}'
        WHERE id = ${todoId};`;
        await db.run(updatePriority);
        response.send("Priority Updated");
      } else {
        response.status(400);
        response.send("Invalid Todo Priority");
      }
      break;

    // scenario 3
    case todo !== undefined:
      const updateTodo = `
        UPDATE todo
        SET
        todo='${todo}'
        WHERE id = ${todoId};`;
      await db.run(updateTodo);
      response.send("Todo Updated");
      break;

    // scenario 4
    case category !== undefined:
      const categoryArray = [`WORK`, `HOME`, `LEARNING`];
      const isValidCategory = await categoryArray.includes(category);
      if (isValidCategory) {
        const updateCategory = `
        UPDATE todo
        SET
        category='${category}'
        WHERE id = ${todoId};`;
        await db.run(updateCategory);
        response.send("Category Updated");
      } else {
        response.status(400);
        response.send("Invalid Todo Category");
      }
      break;

    // scenario 5
    case dueDate !== undefined:
      const isValidDate = await isValid(new Date(dueDate));
      if (isValidDate) {
        const modifiedDate = format(new Date(dueDate), "yyyy-MM-dd");
        const updateDueDate = `
        UPDATE todo
        SET
        due_date='${modifiedDate}'
        WHERE id = ${todoId};`;
        await db.run(updateDueDate);
        response.send("Due Date Updated");
      } else {
        response.status(400);
        response.send("Invalid Due Date");
        return;
      }
      break;
  }
});

// scenario 6 //
app.delete("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const deleteTodo = `
    DELETE FROM todo
    WHERE id=${todoId};`;
  await db.run(deleteTodo);
  response.send("Todo Deleted");
});
