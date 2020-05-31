export interface IResource {
    validate(): string[];
    throwErrorIfInvalid(): void;
}

