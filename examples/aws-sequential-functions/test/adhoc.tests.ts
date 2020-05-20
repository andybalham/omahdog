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
    
    readonly environmentVariableName?: string;
    readonly resourceName?: string;

    constructor(environmentVariableName?: string, resourceName?: string) {
        
        super(EnvironmentVariableValue);
        
        this.environmentVariableName = environmentVariableName;
        this.resourceName = resourceName;
    }

    getValue(): string | undefined {
        if (this.environmentVariableName === undefined) throw new Error('this.environmentVariableName === undefined');
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
                result: 'result'
            }
        };

        this.services.tableService.documentClient.put(params);

    }
}

describe('Ad-hoc tests', () => {

    it('test handler reflection', () => {
        
        process.env.FLOW_RESULT_TABLE_NAME = 'Aloha!';
        
        const resources = {
            flowResultTable: 'FlowResultTable'
        };

        const flowResultTableNameEnvVar = new EnvironmentVariableValue('FLOW_RESULT_TABLE_NAME', resources.flowResultTable);

        const handler = new Handler;
        handler.services.tableService = {
            documentClient: new DocumentClient, // TODO 20May20: Should this be a function too? I.e. just provide the wiring to get the instance
            tableName: flowResultTableNameEnvVar
        };

        if ('services' in handler) {
            console.log(JSON.stringify(handler.services));
            handler.handle();
        }
    });
});