export interface IService {
    validate(): string[];
    throwErrorIfInvalid(): void;
}

