class TestRequest {
    numberValue?: number = undefined;
    stringValue?: string = undefined;
}

class DocumentClient {
    put(params: any): void {}
}

abstract class ConfigurationValue {

    readonly configurationValueType: string;
    
    constructor(type: new () => ConfigurationValue) {
        this.configurationValueType = type.name;
    }

    abstract getValue(): string | undefined;

    get value(): string | undefined {
        return this.getValue();
    }
}

class EnvironmentVariableValue extends ConfigurationValue {
    
    readonly environmentVariableName: string;

    constructor(environmentVariableName?: string) {
        super(EnvironmentVariableValue);
        if (environmentVariableName === undefined) throw new Error('environmentVariableName === undefined');
        this.environmentVariableName = environmentVariableName;
    }

    getValue(): string | undefined {
        return process.env[this.environmentVariableName];
    }
}

class ConstantValue extends ConfigurationValue {
    
    readonly constantValue?: string;

    constructor(constantValue?: string) {
        super(ConstantValue);
        this.constantValue = constantValue;
    }

    getValue(): string | undefined {
        return this.constantValue;
    }
}

class HandlerService {
}

class DynamoDbTableService extends HandlerService {
    documentClient: DocumentClient;
    tableName: ConfigurationValue; 
    itemResult: ConfigurationValue; 
}

class Handler {

    services = {
        tableService: new DynamoDbTableService
    }

    handle(): void {

        const params: any = {
            TableName: this.services.tableService.tableName.value,
            Item: {
                id: 'id',
                result: this.services.tableService.itemResult.value
            }
        };

        this.services.tableService.documentClient.put(params);

    }
}

describe('Ad-hoc tests', () => {

    it('test handler reflection', () => {
        
        process.env.MY_ENVIRONMENT_VARIABLE = 'Aloha!';
        
        const myEnvironmentVariable = new EnvironmentVariableValue('MY_ENVIRONMENT_VARIABLE');

        const handler = new Handler;
        handler.services.tableService = {
            documentClient: new DocumentClient, // TODO 20May20: Should this be a function too? I.e. just provide the wiring to get the instance
            tableName: myEnvironmentVariable,
            itemResult: new ConstantValue('Change is the only constant')
        };

        if ('services' in handler) {
            console.log(JSON.stringify(handler.services));
            handler.handle();
        }
    });
});