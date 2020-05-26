import DynamoDB from 'aws-sdk/clients/dynamodb';
import { Lambda, SNS } from 'aws-sdk';

import { HandlerFactory } from './omahdog/FlowContext';
import { ResourceReference, EnvironmentVariable, ResourceAttributeReference } from './omahdog-aws/SAMTemplate';
import { DynamoDbTableCrudService, LambdaInvokeService, SNSTopicPublishService } from './omahdog-aws/AwsServices';

import { AddThreeNumbersHandler } from './handlers/AddThreeNumbersHandler';
import { AddTwoNumbersHandler } from './handlers/AddTwoNumbersHandler';
import { StoreTotalHandler } from './handlers/StoreTotalHandler';
import { SumNumbersLambdaProxy, StoreTotalLambdaProxy, AddTwoNumbersLambdaProxy, AddThreeNumbersLambdaProxy } from './lambdaProxies';
import { SumNumbersMessageProxy, StoreTotalMessageProxy, AddTwoNumbersMessageProxy, AddThreeNumbersMessageProxy } from './messageProxies';

// TODO 04May20: Is there any way we can lazy load these? What is the overhead of them being created for *each* function?

const documentClient = new DynamoDB.DocumentClient();
const lambda = new Lambda();
const sns = new SNS();

const resourceNames = {
    flowResultTable: 'FlowResultTable',

    // TODO 25May20: How to get the name of the function services?
    sumNumbersFunction: 'SumNumbersFunction',
    storeTotalFunction: 'StoreTotalFunction',
    addTwoNumbersFunction: 'AddTwoNumbersFunction',
    addThreeNumbersFunction: 'AddThreeNumbersFunction',

    flowExchangeTopic: 'FlowExchangeTopic',
};

const templateReferences = {
    flowResultTable: new ResourceReference(resourceNames.flowExchangeTopic),

    sumNumbersFunction: new ResourceReference(resourceNames.sumNumbersFunction),
    storeTotalFunction: new ResourceReference(resourceNames.storeTotalFunction),
    addTwoNumbersFunction: new ResourceReference(resourceNames.addTwoNumbersFunction),
    addThreeNumbersFunction: new ResourceReference(resourceNames.addThreeNumbersFunction),

    flowExchangeTopicName: new ResourceAttributeReference(resourceNames.flowExchangeTopic, 'TopicName'),
    flowExchangeTopicArn: new ResourceReference(resourceNames.flowExchangeTopic),
};

const environmentVariables = {
    flowResultTableName: new EnvironmentVariable(templateReferences.flowResultTable, 'FLOW_RESULT_TABLE_NAME'),

    sumNumbersFunctionName: new EnvironmentVariable(templateReferences.sumNumbersFunction, 'SUM_NUMBERS_FUNCTION_NAME'),
    storeTotalFunctionName: new EnvironmentVariable(templateReferences.storeTotalFunction, 'STORE_TOTAL_FUNCTION_NAME'),
    addTwoNumbersFunctionName: new EnvironmentVariable(templateReferences.addTwoNumbersFunction, 'ADD_TWO_NUMBERS_FUNCTION_NAME'),
    addThreeNumbersFunctionName: new EnvironmentVariable(templateReferences.addThreeNumbersFunction, 'ADD_THREE_NUMBERS_FUNCTION_NAME'),

    flowExchangeTopicArn: new EnvironmentVariable(templateReferences.flowExchangeTopicArn, 'FLOW_EXCHANGE_TOPIC_ARN')
};

const services = {
    flowResultTable: new DynamoDbTableCrudService(templateReferences.flowResultTable, environmentVariables.flowResultTableName, documentClient),

    sumNumbersFunction: new LambdaInvokeService(templateReferences.sumNumbersFunction, environmentVariables.sumNumbersFunctionName, lambda),
    storeTotalFunction: new LambdaInvokeService(templateReferences.storeTotalFunction, environmentVariables.storeTotalFunctionName, lambda),
    addTwoNumbersFunction: new LambdaInvokeService(templateReferences.addTwoNumbersFunction, environmentVariables.addTwoNumbersFunctionName, lambda),
    addThreeNumbersFunction: new LambdaInvokeService(templateReferences.addThreeNumbersFunction, environmentVariables.addThreeNumbersFunctionName, lambda),

    flowExchangeTopic: new SNSTopicPublishService(templateReferences.flowExchangeTopicName, environmentVariables.flowExchangeTopicArn, sns),
};

export const handlerFactory = new HandlerFactory()

    .addInitialiser(StoreTotalHandler, handler => {
        handler.services.flowResultTable = services.flowResultTable;
    })

    .addInitialiser(SumNumbersLambdaProxy, handler => {
        handler.services.lambda = services.sumNumbersFunction;
    })
    .addInitialiser(StoreTotalLambdaProxy, handler => {
        handler.services.lambda = services.storeTotalFunction;
    })
    .addInitialiser(AddTwoNumbersLambdaProxy, handler => {
        handler.services.lambda = services.addTwoNumbersFunction;
    })
    .addInitialiser(AddThreeNumbersLambdaProxy, handler => {
        handler.services.lambda = services.addThreeNumbersFunction;
    })
    
    .addInitialiser(SumNumbersMessageProxy, handler => {
        handler.services.requestTopic = services.flowExchangeTopic;
    })
    .addInitialiser(StoreTotalMessageProxy, handler => {
        handler.services.requestTopic = services.flowExchangeTopic;
    })
    .addInitialiser(AddTwoNumbersMessageProxy, handler => {
        handler.services.requestTopic = services.flowExchangeTopic;
    })
    .addInitialiser(AddThreeNumbersMessageProxy, handler => {
        handler.services.requestTopic = services.flowExchangeTopic;
    })
    ;
    
    