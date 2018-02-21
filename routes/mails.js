const config = require('../config')
const descriptions = require('../descriptions')
const ovh = require('ovh')(config.ovh)
const express = require('express')
const router = express.Router()
const Promise = require('bluebird')
const verification = require('../middlewares/slack')
const messages = require('../lib/messages')

const specialRedirections = [
  {short: 'contact', full: 'contact@beta.gouv.fr'},
  {short: 'contact@openacademie', full: 'contact@openacademie.beta.gouv.fr'}
]

shortSpecialRedirections = specialRedirections.map(item => item.short)
fullSpecialRedirections = specialRedirections.map(item => item.full)

const helpMessage = `Commandes disponibles:\n
  \t- \`/emails list\`\t\tliste des listes de diffusions existantes
  \t- \`/emails list nomdelaliste\`\t\tliste des personnes dans la liste nomdelaliste
  \t- \`/emails join nomdelaliste nom.prenom@beta.gouv.fr\`\trejoindre la liste nomdelaliste
  \t- \`/emails leave nomdelaliste nom.prenom@beta.gouv.fr\`\tquitter la liste nomdelaliste

  Plus d'infos sur https://github.com/sgmap/slack-ovh`

function fillDescription(id) {
  const description = descriptions[id] || 'Ajoutez votre description ici 👉 https://github.com/sgmap/slack-ovh/blob/master/descriptions.json'
  return `*${id}*: ${description}`
}

function buildLongDescription(list) {
  return list.reduce((acc, item) => {
    return acc + `- ${fillDescription(item)}\n`
  }, 'Listes de diffusions existantes:\n')
}

function getMailingLists() {
  return ovh.requestPromised('GET', `/email/domain/beta.gouv.fr/mailingList`)
    .then(list => list.concat(shortSpecialRedirections))
    .then(buildLongDescription)
}

function filterFromRedirections(mailingList) {
  return (list) => {
    const fullRedirection = specialRedirections.find(item => item.short === mailingList).full
    return list.filter(item => item.from === fullRedirection)
  }
}

function getSubscribers(mailingList) {
  if (shortSpecialRedirections.indexOf(mailingList) >= 0) {
    return getAllRedirections()
      .then(filterFromRedirections(mailingList))
      .then(list => {
        return list.reduce((acc, item) => {
          return acc + `- ${item.to}\n`
        }, `Personnes inscrites à ${mailingList}:\n`)
      })
  }

  return ovh.requestPromised('GET', `/email/domain/beta.gouv.fr/mailingList/${mailingList}/subscriber`)
    .then(list => {
      return list.reduce((acc, item) => {
        return acc + `- ${item}\n`
      }, `Personnes inscrites à ${mailingList}:\n`)
    })
}

function getAllRedirections() {
  return ovh.requestPromised('GET', `/email/domain/beta.gouv.fr/redirection`)
    .then(redirectionIds => {
      const mapper = id => ovh.requestPromised('GET', `/email/domain/beta.gouv.fr/redirection/${id}`)

      return Promise.map(redirectionIds, mapper)
    })
}

function findExistingRedirection(email, mailingList) {
  return (list) => {
    const found = list.find(redirection => {
      return redirection.from === mailingList && redirection.to === email
    })

    if (!found) {
      throw {message: `Impossible de trouver la redirection de ${email} vers ${mailingList}`}
    }
  }
}

function removeRedirection(redirection) {
  return ovh.requestPromised('DELETE', `/email/domain/${domain}/redirection/${redirection.id}`)
}

function list(res, mailingList) {
  let getListPromise

  if (mailingList) {
    getListPromise = getSubscribers(mailingList)
  } else {
    getListPromise = getMailingLists()
  }

  return getListPromise
    .then(text => res.send(messages.ephemeral(text)))
    .catch(err => res.send(messages.error(err)))
}

function help(res) {
  return res.send(messages.ephemeral(helpMessage))
}

function join(res, mailingList, email) {
  let subscribePromise

  if (shortSpecialRedirections.indexOf(mailingList) >= 0) {
    // Add redirection
    subscribePromise = ovh.requestPromised('POST', `/email/domain/beta.gouv.fr/redirection`, {
      from: `${mailingList}@beta.gouv.fr`,
      to: email,
      localCopy: false
    })
  } else {
    // Subscribe from mailing-list
    subscribePromise = ovh.requestPromised('POST', `/email/domain/beta.gouv.fr/mailingList/${mailingList}/subscriber`, { email })
  }

  const successText = `Inscription de *${email}* à la liste *${mailingList}* réussie.`

  return subscribePromise
    .then(() => res.send(messages.inChannel(successText)))
    .catch(err => res.send(messages.error(err)))
}

function leave(res, mailingList, email) {
  let leavePromise

  if (shortSpecialRedirections.indexOf(mailingList) >= 0) {
    // Remove redirection
    leavePromise = getAllRedirections()
      .then(findExistingRedirection(email, mailingList))
      .then(removeRedirection)
  } else {
    // Unsubscribe from mailing-list
    leavePromise = ovh.requestPromised('DELETE', `/email/domain/beta.gouv.fr/mailingList/${mailingList}/subscriber/${email}`)
  }

  const successText = `Désinscription de *${email}* à la liste *${mailingList}* réussie.`

  return leavePromise
    .then(() => res.send(messages.inChannel(successText)))
    .catch(err => res.send(messages.error(err)))
}

router.post('/', verification, function(req, res, next) {
  if (!req.body || !req.body.text) {
    return help(res)
  }

  let [ cmd, mailingList, email ] = req.body.text.split(' ')

  switch(cmd) {
    case 'join':
      return join(res, mailingList, email)
    case 'leave':
      return leave(res, mailingList, email)
    case 'list':
      return list(res, mailingList)
    default:
      return help(res)
  }
})

module.exports = router
