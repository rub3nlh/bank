import { cleanIban } from 'utils';
import { ValidationError } from 'exceptions';
import {login, createNationalTransfer, createInternationalTransfer} from './base';
import {CountryCodes} from 'utils/constants';

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

async function international({nif, password, sourceAccount, destinationAccount, swift, amount, beneficiary, ...transferOptions}) {
    validate(nif, 'nif');
    validate(password, 'password');
    validate(sourceAccount, 'sourceAccount');
    validate(destinationAccount, 'destinationAccount');
    validate(swift, 'swift');
    validate(amount, 'amount');
    validate(beneficiary, 'beneficiary');

    if(!beneficiary.country || !CountryCodes.includes(beneficiary.country)) {
        throw new ValidationError("Invalid beneficiary.country");
    }

    const {sid} = await login(nif, password);
    return createInternationalTransfer({
        sourceAccount: cleanIban(sourceAccount),
        destinationAccount: cleanIban(destinationAccount),
        swift,
        amount,
        nif,
        beneficiary,
        ...transferOptions
    }, sid);
}

export default {
    national,
    international
}
