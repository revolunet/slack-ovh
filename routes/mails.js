const config = require('../config')
const descriptions = require('../descriptions')
const ovh = require('ovh')(config.ovh)
const express = require('express')
const router = express.Router()
const verification = require('../middlewares/slack')

function fillDescription(id) {
  const description = descriptions[id] || 'Ajoutez votre description ici 👉 https://github.com/sgmap/slack-ovh/blob/master/descriptions.json'
  return `*${id}*: ${description}`
}

function toText(list) {
  return list.reduce((acc, item) => {
    return acc + `- ${fillDescription(item)}\n`
  }, 'Listes de diffusions existantes:\n')
}

function addSpecialRedirections(list) {
  const specialRedirections = ['contact']

  return list.concat(specialRedirections)
}

function list(res) {
  return ovh.requestPromised('GET', `/email/domain/beta.gouv.fr/mailingList`)
    .then(addSpecialRedirections)
    .then(toText)
    .then(text => res.send({
      text,
      mrkdwn: true,
      response_type: 'ephemeral'
    }))
}

function help(res) {
  return res.send({
    text: `Commandes disponibles:\n\t\`/emails list\`\tliste des listes de diffusions existantes`,
    mrkdwn: true,
    response_type: 'ephemeral'
  })
}

router.post('/', verification, function(req, res, next) {
  const { text } = req.body

  switch(text) {
    case 'list':
      return list(res)
    default:
      return help(res)
  }
})

module.exports = router
