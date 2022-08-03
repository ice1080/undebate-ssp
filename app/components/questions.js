// https://github.com/EnCiv/undebate-ssp/issues/48
import React, { useState, useEffect, useReducer } from 'react'
import { createUseStyles } from 'react-jss'
import cx from 'classnames'
import CountLimitedTextInput from './count-limited-text-input'
import Submit from './submit'
import ElectionTextInput from './election-text-input'

Array.prototype.test = function (f) {
    if (f(this)) return this
    return undefined
}

export default function Questions({ className, style, electionOM, onDone }) {
    const classes = useStyles()
    const [electionObj, electionMethods] = electionOM
    const [error, setError] = useState('')
    const [lockedMessage, setLockedMessage] = useState('')
    const [isValid, setIsValid] = useState(false)

    const { questions = {} } = electionObj

    const [validInputs, setValidInputs] = useReducer((state, action) => ({ ...state, ...action }), {
        0: { text: null, time: null },
    })

    // side effects to do after the component rerenders from a state change
    const [sideEffects] = useState([]) // never set sideEffects
    useEffect(() => {
        while (sideEffects.length) sideEffects.shift()()
    })

    const checkValid = () => {
        // check questions are locked or not
        if (electionMethods.areQuestionsLocked()) {
            setLockedMessage('the invitation has been sent, questions cannot be changed')
            return false
        }
        setLockedMessage('')
        return true
    }

    const validSubmit = () => {
        // check valid when all of the empty questions in the bottom
        const arr = Object.entries(questions).map((key, question) => questions[question])
        const firstEmptyIndex = arr.findIndex(q => q.text === '')
        const lastNotEmptyIndex = arr.length - 1 - arr.reverse().findIndex(q => q.text !== '')

        if (firstEmptyIndex !== -1 && firstEmptyIndex < lastNotEmptyIndex) {
            setError('All of the empty questions must be below filled questions')
            return false
        }
        return true
    }

    useEffect(() => {
        setIsValid(checkValid())
    }, [isValid, electionOM])

    useEffect(() => {
        if (electionMethods.checkObjCompleted(questions)) {
            setError('')
        }
    }, [electionOM, error, questions])

    const addQuestion = () => {
        if (Object.keys(questions).length === 0 || electionMethods.checkObjCompleted(questions)) {
            setError('')
            sideEffects.push(() =>
                electionMethods.upsert({ questions: { [Object.keys(questions).length]: { text: '' } } })
            )
            setValidInputs({ [Object.keys(questions).length]: { text: '' } })
        } else {
            setError('Please fill out empty question before adding more')
        }
    }

    return (
        <div className={cx(className, classes.container)} style={style}>
            <div className={classes.send}>
                <span>What questions would you like to ask the candidates?</span>
                <Submit
                    disabled={
                        electionMethods.areQuestionsLocked() ||
                        !Object.values(questions)
                            .test(a => a.length > 0)
                            ?.every(q => q.text && q.time)
                    }
                    onDone={() => {
                        onDone({
                            value: questions,
                            valid: isValid && validSubmit(),
                        })
                    }}
                />
            </div>
            <div className={classes.questionBox}>
                {Object.entries(questions).map((key, qIndex) => (
                    <div className={classes.questionTime}>
                        <CountLimitedTextInput
                            className={classes.questionInput}
                            warn={!questions[qIndex].text && questions[qIndex].time}
                            key={key}
                            name={`Question ${qIndex + 1}`}
                            maxCount={250}
                            defaultValue={questions[qIndex].text}
                            onDone={({ valid, value }) => {
                                if (
                                    (validInputs[qIndex] !== null || valid) &&
                                    electionObj.questions[qIndex].text !== value
                                ) {
                                    sideEffects.push(() =>
                                        electionMethods.upsert({ questions: { [qIndex]: { text: value } } })
                                    )
                                }
                                setValidInputs({ [qIndex]: { text: value } })
                            }}
                        />
                        <ElectionTextInput
                            className={classes.timeInput}
                            warn={questions[qIndex].text && !questions[qIndex].time}
                            key={key + 'time'}
                            name='Seconds'
                            type='number'
                            defaultValue={questions[qIndex].time}
                            onDone={({ valid, value }) => {
                                if (
                                    (validInputs[qIndex] !== null || valid) &&
                                    electionObj.questions[qIndex].time !== value
                                ) {
                                    sideEffects.push(() =>
                                        electionMethods.upsert({ questions: { [qIndex]: { time: value } } })
                                    )
                                }
                                setValidInputs({ [qIndex]: { time: value } })
                            }}
                        />
                    </div>
                ))}
            </div>
            <button className={classes.addQuestionBtn} disabled={!isValid} onClick={addQuestion} type='button'>
                Add question
            </button>
            {error && <p className={classes.err}>{error}</p>}
            {lockedMessage && <p className={classes.err}>{lockedMessage}</p>}
        </div>
    )
}

const useStyles = createUseStyles(theme => ({
    container: {
        display: 'flex',
        flexDirection: 'column',
        fontFamily: theme.defaultFontFamily,
        color: theme.colorSecondary,
    },
    send: {
        display: 'flex',
        justifyContent: 'space-between',
    },
    questionBox: {
        width: '70%',
        fontFamily: theme.defaultFontFamily,
    },
    questionTime: {
        display: 'flex',
        columnGap: '1rem',
        marginTop: '1.5rem',
    },
    questionInput: {
        flexGrow: 1,
    },
    timeInput: {
        width: '6rem',
    },
    addQuestionBtn: {
        color: theme.colorSecondary,
        background: 'white',
        border: `1px solid ${theme.colorSecondary}`,
        alignSelf: 'flex-start',
        padding: theme.buttonPadding,
        borderRadius: theme.buttonBorderRadius,
        fontWeight: 600,
        '&:hover': {
            cursor: 'pointer',
        },
        marginTop: '1.5625rem',
    },
    err: {
        color: 'red',
    },
    warn: {
        backgroundColor: theme.backgroundColorWarning,
    },
}))
