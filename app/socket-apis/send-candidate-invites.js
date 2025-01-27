// https://github.com/EnCiv/undebate-ssp/issues/146
import { SibGetTemplateId, SibSendTransacEmail } from '../lib/send-in-blue-transactional'
import getElectionStatusMethods, { getLatestIota, candidateFilters } from '../lib/get-election-status-methods'
import { getElectionDocById } from './get-election-docs'
import { Iota } from 'civil-server'
import { updateElectionInfo } from './subscribe-election-info'
import { cloneDeep } from 'lodash'
import scheme from '../lib/scheme'

var templateId

export default async function sendCandidateInvites(id, filter, cb) {
    const userId = this.synuser && this.synuser.id
    if (!userId) {
        logger.error('sendCandidateInvite user not logged in')
        cb && cb()
        return
    }
    if (!templateId) {
        templateId = await SibGetTemplateId('candidate-invitation')
        if (!templateId) {
            logger.error('sendCandidateInvite template not found')
            cb && cb()
            return
        }
    }
    if (!candidateFilters[filter]) {
        logger.error('sendCandidateInvite filter not found:', filter)
        cb && cb()
        return
    }
    getElectionDocById.call(this, id, async iota => {
        if (!iota) {
            logger.error('sendCandidateInvites id not found', id)
            cb && cb()
            return
        }
        const electionObj = iota.webComponent
        const messageIds = await sendCandidateInvitesFromIdAndElectionObj(id, electionObj, filter)
        cb && cb(messageIds)
    })
}

export async function sendCandidateInvitesFromIdAndElectionObj(id, electionObj, filter = 'ALL') {
    const electionMethods = getElectionStatusMethods(undefined, electionObj)
    if (!electionMethods.areCandidatesReadyForInvites()) {
        logger.error('areCandidatesReadyForInvites candidates not ready to invite', electionObj.candidates)
        return {}
    }
    const submissionDeadline = new Date(
        electionMethods.getLatestObj(electionObj.timeline.candidateSubmissionDeadline).date
    ).toLocaleString()
    const docs = []
    const questions = cloneDeep(electionObj.questions)
    const messageIds = []
    const filterOp = candidateFilters[filter]
    if (!filterOp) {
        logger.error('sendCandidateInvitesFromIdAndElectionObj filter not found:', filter)
        return {}
    }
    for await (const candidate of Object.values(electionObj.candidates)) {
        if (!filterOp(candidate)) continue
        if (!getLatestIota(candidate?.recorders)?.path) {
            logger.error(
                'sendCandidateInvitesFromIdAndElectionObj in electionObj',
                id,
                "skipping canidate because there's no recorder",
                candidate?.uniqueId
            )
            continue
        }
        const params = {
            name: electionObj.name,
            email: electionObj.email,
            organizationName: electionObj.organizationName,
            organizationLogo:
                electionObj.organizationLogo ||
                'https://res.cloudinary.com/hf6mryjpf/image/upload/v1664306598/assets/undebate-logo_qczkk6.png',
            moderator: {
                name: electionObj.moderator.name,
                email: electionObj.moderator.email,
            },
            questions,
            candidate: {
                name: candidate.name,
                email: candidate.email,
                uniqueId: candidate.uniqueId,
                office: candidate.office,
                recorder_url: scheme() + process.env.HOSTNAME + electionMethods.getLatestIota(candidate.recorders).path,
                submissionDeadline,
            },
        }
        const messageProps = {
            params,
            to: [{ email: candidate.email, name: candidate.name }],
            sender: {
                name:
                    (electionObj.name || 'Election Administrator') +
                    ' @ ' +
                    electionObj.organizationName +
                    ' via EnCiv.org',
                email: process.env.SENDINBLUE_DEFAULT_FROM_EMAIL,
            },
            templateId,
            tags: [`id:${id}`, 'role:candidate', `office:${candidate.office}`],
        }
        if (params.email) messageProps.cc = [{ email: params.email, name: params.name }]
        const result = await SibSendTransacEmail(messageProps)
        if (!result || !result.messageId) logger.error('send candidate invite failed', id, candidate)
        else {
            messageIds.push({ uniqueId: candidate.uniqueId, messageId: result.messageId })
            try {
                const doc = await Iota.create({
                    parentId: id,
                    subject: 'Candidate Invite Sent',
                    description: `Candidate Invite Sent for election ${electionObj?.electionName || id}`,
                    component: {
                        component: 'CandidateInviteSent',
                        messageId: result.messageId,
                        ...messageProps,
                        sentDate: new Date().toISOString(),
                    },
                })
                docs.push(doc)
            } catch (error) {
                logger.error("send-candidate-invite couldn't create Iota for CandidateInviteSent", error)
            }
        }
    }
    // send one update to the browser, not one update for each candidate in the list
    if (docs.length) updateElectionInfo(id, id, docs)
    return messageIds
}
