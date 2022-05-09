import { google } from 'googleapis'
import { oauth2callbacks } from '../routes/google-auth-redirect'

async function getSheetsData(spreadsheetId, oauth2Client, cb) {
    const SHEET_VALUES_RANGE = 'A:ZZ'
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client })
    const res = await sheets.spreadsheets.values.get({
        auth: oauth2Client,
        spreadsheetId: spreadsheetId,
        range: SHEET_VALUES_RANGE,
    })
    logger.debug('data stuff', res.data.values)
    if (res && res.data && res.data.values) {
        cb(JSON.stringify(res.data.values))
    } else {
        cb()
    }
}

export default async function extractSheetData(uniqueId, spreadsheetId, cb) {
    // todo add back in
    /* if (!this.synuser) {
     *     logger.error('extractSheetData called, but no user ', this.synuser)
     *     if (cb) cb() // no user
     *     return
     * } */
    try {
        // this is the second socket call so we add the callback to the oauth2callbacks list item so that the data gets back to the browser
        const item = oauth2callbacks.find(obj => obj.uniqueId === uniqueId)
        item.callback = () => getSheetsData(spreadsheetId, item.oauth2Client, cb)
    } catch (err) {
        logger.error('err', err)
        if (cb) cb()
    }
}
