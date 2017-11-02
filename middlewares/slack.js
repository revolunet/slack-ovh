const token = require('../config').token

function verification(req, res, next) {
  if (token === req.body.token) {
    next();
  } else {
    res.sendStatus(401);
  }
}

module.exports = verification
