import dotenv from 'dotenv-flow';
import transfer from 'transfer';

function nationalTransfer() {
    return transfer.national({
        nif: process.env.NIF,
        password: process.env.PASSWORD,
        sourceAccount: process.env.SOURCE_ACCOUNT,
        destinationAccount: "ES8420389159427535769624",
        amount: 1.03,
        beneficiary: 'Testing Prueba PRueba',
        concept: process.env.CONCEPT
    })
}

function internationalTransfer() {
    return transfer.international({
        nif: process.env.NIF,
        password: process.env.PASSWORD,
        sourceAccount: process.env.SOURCE_ACCOUNT,
        destinationAccount: "9225 0699 9136 3479",
        swift: "BDCRCUHHXXX",
        amount: 1.03,
        concept: process.env.CONCEPT,
        beneficiary: {
            name: 'Testing Prueba PRueba',
            address: 'Calle los pinos edificio123 APTO C 4 Reparto Hermanos Cruz',
            town: 'La Habana',
            country: 'CUba'
        }
    })
}

dotenv.config();
export default {nationalTransfer, internationalTransfer}
