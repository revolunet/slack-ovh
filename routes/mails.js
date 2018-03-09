const config = require('../config')
const descriptions = require('../descriptions')
const redirections = require('../redirections')
const ovh = require('ovh')(config.ovh)
const express = require('express')
const router = express.Router()
const Promise = require('bluebird')
const verification = require('../middlewares/slack')
const messages = require('../lib/messages')

const helpMessage = `Commandes disponibles:
  \t- \`/emails list\`\t\tliste des listes de diffusions existantes
  \t- \`/emails list emaildelaliste\`\t\tliste des personnes dans la liste
  \t- \`/emails join emaildelaliste nom.prenom@beta.gouv.fr\`\trejoindre la liste
  \t- \`/emails leave emaildelaliste nom.prenom@beta.gouv.fr\`\tquitter la liste

  Ajoutez votre liste contact ici 👉 https://github.com/betagouv/slack-ovh/blob/master/redirections.json
  Plus d'infos sur https://github.com/betagouv/slack-ovh`

function fillDescription(id) {
  const description = descriptions[id] || 'Ajoutez votre description ici 👉 https://github.com/betagouv/slack-ovh/blob/master/descriptions.json'
  return `*${id}*: ${description}`
}

function buildLongDescription(list) {
  return list.reduce((acc, item) => {
    return acc + `- ${fillDescription(item)}\n`
  }, 'Listes de diffusions existantes:\n')
}

function getMailingLists() {
  return ovh.requestPromised('GET', `/email/domain/beta.gouv.fr/mailingList`)
    .then(list => list.concat(redirections))
    .then(buildLongDescription)
}

function filterFromRedirections(redirection) {
  return (list) => {
    return list.filter(item => item.from === redirection)
  }
}

function getSubscribers(mailingList) {
  if (redirections.indexOf(mailingList) >= 0) {
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
      throw {message: `Impossible de trouver la redirection de ${mailingList} vers ${email}`}
    }

    return found
  }
}

function removeRedirection(redirection) {
  return ovh.requestPromised('DELETE', `/email/domain/beta.gouv.fr/redirection/${redirection.id}`)
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

  const isSpecial = redirections.find(item => item === mailingList)
  if (isSpecial) {
    // Add redirection
    subscribePromise = ovh.requestPromised('POST', `/email/domain/beta.gouv.fr/redirection`, {
      from: isSpecial,
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

  if (redirections.indexOf(mailingList) >= 0) {
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
