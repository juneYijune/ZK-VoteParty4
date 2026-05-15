var usersService = require("../services/users.service");

function getUsers(req, res, next) {
  var users = usersService.listUsers();
  res.json({ users: users });
}

module.exports = {
  getUsers,
};
