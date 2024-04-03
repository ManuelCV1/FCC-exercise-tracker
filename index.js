const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const mongoose = require("mongoose");

//Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI);

//mongoose config
let userSchema = new mongoose.Schema({
  username: {
    type: String,
    require: true,
  },
  description: {
    type: String,
  },
  duration: { type: String },
  date: { type: Date },
  from: { type: String },
  to: { type: String },
  count: {
    type: Number,
    default: 0,
  },
  log: [
    {
      description: String,
      duration: Number,
      date: { type: Date },
    },
  ],
});

let User = mongoose.model("User", userSchema);

//mongoose cuztom funtions
const createAndSaveUser = async (username) => {
  const userNew = new User({
    username,
  });
  try {
    const dataUser = await userNew.save();
    console.log(dataUser, "Se ha guardado exitosamente");
    return dataUser;
  } catch (err) {
    console.log("Error Guardando Usario: ", err);
  }
};

const findUsers = async (id, from, to, limit) => {
  try {
    if ((id && from) || (id && limit)) {
      //HERE problem
      let opciones = {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      };
      const user = await User.findById(id)
        .where("log.date")
        .gte(from || new Date("1970-01-01")) //HERE
        .lte(to || new Date("9999-12-31")) //
        .slice("log", limit ? limit : Infinity);

      const userToSend = user.toObject();
      userToSend.from = from ? checkDate(from) : null;
      userToSend.to = to ? checkDate(to) : null;
      userToSend.count = limit ? limit : user.log.length;
      userToSend.log.forEach((log) => {
        log.date = new Date(log.date)
          .toLocaleDateString("en-US", opciones)
          .replace(/,/g, "")
          .toString();
        delete log._id;
      });
      delete userToSend.__v;
      return userToSend;
    } else if (id) {
      const user = await User.findById(id);
      const userToSend = user.toObject();
      userToSend.log.forEach((log) => {
        log.date = checkDate(log.date);
      });
      console.log(user, "<---Documento del usaurio seleccionado");
      return userToSend;
    } else {
      const users = await User.find().select({
        username: true,
        _id: true,
        __v: true,
      });
      console.log(users, "<---Lista de todos los usuarios");
      return users;
    }
  } catch (error) {
    console.error("Error al buscar los Usuarios: ", error, id, from, to, limit);
  }
};

const findUserAndAddFields = async (id, description, duration, date) => {
  const userFound = await User.findByIdAndUpdate(id, {
    $push: {
      log: { description, duration, date },
    },
    $inc: { count: 1 },
  });
  console.log("Usuario Actulizado", userFound);
  return userFound;
};

//Middlewares
app.use(cors());
app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});
app.use(express.json()); // Reemplazo de bodyParser.json() (body-parser ya no es necesario , ya son middlewares que estan incorporados en Express 4.16+)
app.use(express.urlencoded({ extended: true })); // Reemplazo de bodyParser.urlencoded()

//
app.post("/api/users", async (req, res) => {
  try {
    console.log(req.body);
    const userDoc = await createAndSaveUser(req.body.username);
    res.json({ username: userDoc.username, _id: userDoc._id.toString() });
  } catch (err) {
    console.log("Error al procesar la solicitud: ", err);
  }
});

app.get("/api/users", async (req, res) => {
  const usersDocs = await findUsers();
  res.json(usersDocs);
});

app.post("/api/users/:_id/exercises", async (req, res) => {
  const id = req.params._id;
  const description = req.body.description;
  const duration = req.body.duration;
  const date = checkDate(req.body.date);
  console.log("Resultados del post:", id, description, duration, date);
  const userDoc = await findUserAndAddFields(id, description, duration, date);
  return res.json({
    _id: id,
    username: userDoc.username,
    date: date,
    duration: Number(duration),
    description,
  });
});

app.get("/api/users/:_id/logs", async (req, res) => {
  const id = req.params._id;
  const fromDate = req.query.from;
  const toDate = req.query.to;
  const limitLogs = Number(req.query.limit);
  console.log(
    "PETICION GET CON RANGO DE BUSQUEDA: ",
    id,
    fromDate,
    toDate,
    limitLogs
  );
  const userDoc = await findUsers(id, fromDate, toDate, limitLogs);
  res.json(userDoc);
});

//cuztom func to check Date
const checkDate = (date) => {
  console.log("AQUI CAYO", date);
  if (!date) {
    return new Date(Date.now()).toDateString();
  } else if (Object.prototype.toString.call(date) === "[object Date]") {
    return date.toDateString();
  } else {
    const parts = date.split("-");
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);

    const utcDate = new Date(Date.UTC(year, month, day));
    return new Date(
      utcDate.getTime() + utcDate.getTimezoneOffset() * 60000
    ).toDateString();
  }
};

//
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
