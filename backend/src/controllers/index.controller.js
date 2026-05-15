function getHome(req, res, next) {
  res.render("index", { title: "Express" });
}

module.exports = {
  getHome,
};
