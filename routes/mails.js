const config = require('../config')
const descriptions = require('../descriptions')
const ovh = require('ovh')(config.ovh)
const express = require('express')
const router = express.Router()
const verification = require('../middlewares/slack')

const help = `Commandes disponibles:\n\t\`/emails list\`\tliste des listes de diffusions existantes`

function maillingListWithDescription(id) {
  const description = descriptions[id] ? descriptions[id] : '[Ajoutez votre description](https://github.com/sgmap/slack-ovh/blob/master/descriptions.json)'
  return `*${id}*: ${description}`
}

function toText(list) {
  return list.reduce((acc, item) => {
    acc += `- ${maillingListWithDescription(item)}\n`
    return acc
  }, 'Listes de diffusions existantes:\n')
}

/* GET mailing-list listing. */
router.post('/', verification, function(req, res, next) {
  const { text } = req.body

  switch(text) {
    case 'list':
      return ovh.requestPromised('GET', `/email/domain/beta.gouv.fr/mailingList`)
        .then(toText)
        .then(text => res.send({ text, mrkdwn: true, response_type: 'ephemeral'}))
    default:
      return res.send({ text: help, mrkdwn: true, response_type: 'ephemeral'})
  }
})

module.exports = router
