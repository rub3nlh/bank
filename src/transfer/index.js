import { cleanIban } from 'utils';
import { ValidationError } from 'exceptions';
import {login, createNationalTransfer, createInternationalTransfer} from './base';

function validate(value, name) {
    if(!value) {
        throw new ValidationError(`${name} was not defined`);
    }
}

async function national({nif, password, sourceAccount, destinationAccount, amount, ...transferOptions}) {
    validate(nif, 'nif');
    validate(password, 'password');
    validate(sourceAccount, 'sourceAccount');
    validate(destinationAccount, 'destinationAccount');
    validate(amount, 'amount');

    const {sid} = await login(nif, password);
    return createNationalTransfer({
        sourceAccount: cleanIban(sourceAccount),
        destinationAccount: cleanIban(destinationAccount),
        amount,
        nif,
        ...transferOptions
    }, sid);
}

async function international({nif, password, sourceAccount, destinationAccount, swift, amount, ...transferOptions}) {
    validate(nif, 'nif');
    validate(password, 'password');
    validate(sourceAccount, 'sourceAccount');
    validate(destinationAccount, 'destinationAccount');
    validate(swift, 'swift');
    validate(amount, 'amount');

    const {sid} = await login(nif, password);
    return createInternationalTransfer({
        sourceAccount: cleanIban(sourceAccount),
        destinationAccount: cleanIban(destinationAccount),
        swift,
        amount,
        nif,
        ...transferOptions
    }, sid);
}

export default {
    national,
    international
}
