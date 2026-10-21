export class ErrorDeDatos extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ErrorDeDatos';
    }
}