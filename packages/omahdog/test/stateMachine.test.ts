import { FlowRequestHandler } from '../src/FlowRequestHandler';
import { FlowBuilder } from '../src/FlowBuilder';
import { FlowDefinition } from '../src/FlowDefinition';
import { FlowContext } from '../src/FlowContext';
import { expect } from 'chai';
import { IActivityRequestHandler, FlowHandlers } from '../src/FlowHandlers';
import { EmptyResponse } from '../src/FlowExchanges';

describe('Handlers', () => {

    it('can handle DipCreated scenario', async () => {

        const flowRequest = new DipCreationRequest();
        flowRequest.caseId = 'caseId';
        flowRequest.lender = 'lender';
        flowRequest.options = { debug: true };
        flowRequest.timestamp = new Date();

        const flowContext = new FlowContext();

        flowContext.mocks
            .add<DipValidateProductAndFeeRequest, DipValidateProductAndFeeResponse>(
                'Validate Product And Fees', request => {
                    expect(request.caseId).to.equal(flowRequest.caseId);
                    expect(request.lender).to.equal(flowRequest.lender);
                    expect(request.options).to.deep.equal(flowRequest.options);
                    expect(request.timestamp).to.equal(flowRequest.timestamp);
                    return { validationResult: ProductAndFeeValidationResult.Success };
                })
            .add<DipValidateMortgageClubRequest, DipValidateMortgageClubResponse>(
                'Validate Mortgage Club', request => {
                    expect(request.caseId).to.equal(flowRequest.caseId);
                    expect(request.lender).to.equal(flowRequest.lender);
                    expect(request.options).to.deep.equal(flowRequest.options);
                    expect(request.timestamp).to.equal(flowRequest.timestamp);
                    return { validationResult: MortgageClubValidationResult.Success };
                })
            .add<UpdateCaseStatusRequest, EmptyResponse>(
                'Update Case Status (DipDecisionInProgress)', request => {
                    expect(request.caseId).to.equal(flowRequest.caseId);
                    expect(request.caseStatus).to.equal(DipCaseStatus.DipDecisionInProgress);
                    return {};
                })
            .add<SendCaseStatusUpdatedEventRequest, EmptyResponse>(
                'Send Case Status Updated Event (DipDecisionInProgress)', request => {
                    expect(request.caseId).to.equal(flowRequest.caseId);
                    expect(request.lender).to.equal(flowRequest.lender);
                    expect(request.updateAt).to.equal(flowRequest.timestamp);
                    expect(request.caseStatus).to.equal(DipCaseStatus.DipDecisionInProgress);
                    return {};
                })
            .add<DipCreateCaseRequest, EmptyResponse>(
                'Create Case', request => {
                    expect(request.caseId).to.equal(flowRequest.caseId);
                    expect(request.lender).to.equal(flowRequest.lender);
                    expect(request.options).to.deep.equal(flowRequest.options);
                    expect(request.timestamp).to.equal(flowRequest.timestamp);
                    return {};
                })
        ;

        const flowResponse = await new DipCreationHandler().handle(flowContext, flowRequest);

        expect((flowResponse as DipCreationResponse).result).to.equal(DipCreationResult.DipCreated);
    });

    it('can be run with handlers', async () => {

        const flowContext = new FlowContext();

        flowContext.handlers = new FlowHandlers()
            .register(DipValidateProductAndFeeRequest, DipValidateProductAndFeeResponse, new DipValidateProductAndFeeHandler())
            .register(DipValidateMortgageClubRequest, DipValidateMortgageClubResponse, new DipValidateMortgageClubHandler())
            .register(UpdateCaseStatusRequest, EmptyResponse, new UpdateCaseStatusHandler())
            .register(SendCaseStatusUpdatedEventRequest, EmptyResponse, new SendCaseStatusUpdatedEventHandler())
            .register(DipCreateCaseRequest, EmptyResponse, new DipCreateCaseHandler())
        ;

        const request = new DipCreationRequest();

        const response = await new DipCreationHandler().handle(flowContext, request);

        expect((response as DipCreationResponse).result).to.equal(DipCreationResult.DipCreated);
    });
});

export class DipCreationHandler extends FlowRequestHandler<DipCreationRequest, DipCreationResponse, DipCreationState> {

    constructor() {
        super(DipCreationHandler, DipCreationResponse, DipCreationState);
    }

    buildFlow(flowBuilder: FlowBuilder<DipCreationRequest, DipCreationResponse, DipCreationState>):
        FlowDefinition<DipCreationRequest, DipCreationResponse, DipCreationState> {

        return flowBuilder
            .initialise((req, state) => {
                state.caseId = req.caseId;
                state.lender = req.lender;
                state.options = req.options;
                state.timestamp = req.timestamp;
            })

        // Validate Product And Fees

            .perform('Validate Product And Fees', DipValidateProductAndFeeRequest, DipValidateProductAndFeeResponse,
                (req, state) => {
                    req.caseId = state.caseId;
                    req.lender = state.lender;
                    req.options = state.options;
                    req.timestamp = state.timestamp;
                },
                (res, state) => {
                    state.productAndFeeValidationResult = res.validationResult;
                })
            .evaluate('Product And Fee Validation Result', state => state.productAndFeeValidationResult, cases => cases
                .whenEqual(ProductAndFeeValidationResult.Success).goto('Validate Mortgage Club')
                .whenEqual(ProductAndFeeValidationResult.InvalidProduct).goto('Invalid Product Selection')
                .whenEqual(ProductAndFeeValidationResult.InvalidFee).goto('Invalid Fee Selection')
                .whenEqual(ProductAndFeeValidationResult.Error).goto('Unknown Failure State')
            ).else().error(v => `Unexpected product and fee validation result: ${v}`)

            .setState('Invalid Product Selection', 
                state => { state.validationStatus = DipValidationStatus.ProductValidationFailed; })
            .goto('HandledFailureState')

            .setState('Invalid Fee Selection', 
                state => { state.validationStatus = DipValidationStatus.ProductFeeValidationFailed; })
            .goto('HandledFailureState')

        // Validate Mortgage Club

            .perform('Validate Mortgage Club', DipValidateMortgageClubRequest, DipValidateMortgageClubResponse,
                (req, state) => {
                    req.caseId = state.caseId;
                    req.lender = state.lender;
                    req.options = state.options;
                    req.timestamp = state.timestamp;
                },
                (res, state) => {
                    state.mortgageClubValidationResult = res.validationResult;
                })
            .evaluate('Mortgage Club Validation Result', state => state.mortgageClubValidationResult, cases => cases
                .whenEqual(MortgageClubValidationResult.Success).goto('Validation Success')
                .whenEqual(MortgageClubValidationResult.InvalidMortgageClub).goto('Invalid Mortgage Club')
                .whenEqual(MortgageClubValidationResult.Error).goto('Unknown Failure State')
            ).else().error(v => `Unexpected mortgage club validation result: ${v}`)

            .setState('Invalid Mortgage Club', 
                state => { state.validationStatus = DipValidationStatus.MortgageClubValidationFailed; })
            .goto('HandledFailureState')

        // Validation Success

            .label('Validation Success')

            .perform('Update Case Status (DipDecisionInProgress)', UpdateCaseStatusRequest, EmptyResponse,
                (req, state) => {
                    req.caseId = state.caseId;
                    req.caseStatus = DipCaseStatus.DipDecisionInProgress;
                })

            .perform('Send Case Status Updated Event (DipDecisionInProgress)', SendCaseStatusUpdatedEventRequest, EmptyResponse,
                (req, state) => {
                    req.caseId = state.caseId;
                    req.caseStatus = DipCaseStatus.DipDecisionInProgress;
                    req.lender = state.lender;
                    req.updateAt = state.timestamp;
                })

            .perform('Create Case', DipCreateCaseRequest, EmptyResponse,
                (req, state) => {
                    req.caseId = state.caseId;
                    req.lender = state.lender;
                    req.options = state.options;
                    req.timestamp = state.timestamp;
                })

            .setState('Set overall result - Dip Created', state => { state.overallResult = DipCreationResult.DipCreated; })

            .end()

        // Handled Failures

            .label('HandledFailureState')

            .perform('Update Case Status for Known Failure', UpdateValidationStatusRequest, EmptyResponse,
                (req, state) => {
                    req.caseId = state.caseId;
                    req.validationStatus = state.validationStatus;
                })

            .perform('Send Case Status Updated Event (ValidationFailure)', SendCaseStatusUpdatedEventRequest, EmptyResponse,
                (req, state) => {
                    req.caseId = state.caseId;
                    req.caseStatus = state.validationStatus;
                    req.lender = state.lender;
                    req.updateAt = state.timestamp;
                })

            .setState('Set overall result - Failed Validation', state => { state.overallResult = DipCreationResult.FailedValidation; })

            .end()

        // Unknown failures

            .label('Unknown Failure State')

            .setState('Set overall result - Error', state => { state.overallResult = DipCreationResult.Error; })

            .end()

        // Finalise

            .finalise((res, state) => {
                res.result = state.overallResult;
            });
    }
}

class DipCreationRequest {
    caseId: string;
    lender: string;
    options: any;
    timestamp: Date;
}

class DipCreationResponse {
    result: DipCreationResult;
}

enum DipCreationResult {
    DipCreated = 'CaseCreated',
    FailedValidation = 'FailedValidation',
    Error = 'Error',
}

class DipCreationState {
    caseId: string;
    lender: string;
    options: any;
    timestamp: Date;
    productAndFeeValidationResult: ProductAndFeeValidationResult;
    mortgageClubValidationResult: MortgageClubValidationResult;
    validationStatus: DipValidationStatus;
    overallResult: DipCreationResult;
}

enum DipValidationStatus {
    ProductFeeValidationFailed = 'ProductFeeValidationFailed',
    ProductValidationFailed = 'ProductValidationFailed',
    MortgageClubValidationFailed = 'MortgageClubValidationFailed',
}

class DipValidateProductAndFeeRequest {
    caseId: string;
    lender: string;
    options: any;
    timestamp: Date;
}

class DipValidateProductAndFeeResponse {
    validationResult: ProductAndFeeValidationResult;
}

class DipValidateProductAndFeeHandler implements IActivityRequestHandler<DipValidateProductAndFeeRequest, DipValidateProductAndFeeResponse> {
    async handle(flowContext: FlowContext, request: DipValidateProductAndFeeRequest): Promise<DipValidateProductAndFeeResponse> {
        const response = new DipValidateProductAndFeeResponse();
        response.validationResult = ProductAndFeeValidationResult.Success;
        return response;
    }
}

enum ProductAndFeeValidationResult {
    Success = 'Success',
    InvalidProduct = 'InvalidProduct',
    InvalidFee = 'InvalidFee',
    Error = 'Error',
}

class DipValidateMortgageClubRequest {
    caseId: string;
    lender: string;
    options: any;
    timestamp: Date;
}

class DipValidateMortgageClubResponse {
    validationResult: MortgageClubValidationResult;
}

class DipValidateMortgageClubHandler implements IActivityRequestHandler<DipValidateMortgageClubRequest, DipValidateMortgageClubResponse> {
    async handle(flowContext: FlowContext, request: DipValidateMortgageClubRequest): Promise<DipValidateMortgageClubResponse> {
        const response = new DipValidateMortgageClubResponse();
        response.validationResult = MortgageClubValidationResult.Success;
        return response;
    }
}

enum MortgageClubValidationResult {
    Success = 'Success',
    InvalidMortgageClub = 'InvalidMortgageClub',
    Error = 'Error',
}

class UpdateCaseStatusRequest {
    caseId: string;
    caseStatus: DipCaseStatus;
}

class UpdateCaseStatusHandler implements IActivityRequestHandler<UpdateCaseStatusRequest, EmptyResponse> {
    async handle(flowContext: FlowContext, request: UpdateCaseStatusRequest): Promise<EmptyResponse> {
        return {};
    }
}

class UpdateValidationStatusRequest {
    caseId: string;
    validationStatus: DipValidationStatus;
}

class SendCaseStatusUpdatedEventRequest {
    caseId: string;
    caseStatus: DipCaseStatus | DipValidationStatus;
    updateAt: Date;
    lender: string;
}

class SendCaseStatusUpdatedEventHandler implements IActivityRequestHandler<SendCaseStatusUpdatedEventRequest, EmptyResponse> {
    async handle(flowContext: FlowContext, request: SendCaseStatusUpdatedEventRequest): Promise<EmptyResponse> {
        return {};
    }
}

enum DipCaseStatus {
    DipDecisionInProgress = 'DipDecisionInProgress',
}

class DipCreateCaseRequest {
    caseId: string;
    lender: string;
    options: any;
    timestamp: Date;
}

class DipCreateCaseHandler implements IActivityRequestHandler<DipCreateCaseRequest, EmptyResponse> {
    async handle(flowContext: FlowContext, request: DipCreateCaseRequest): Promise<EmptyResponse> {
        return {};
    }
}
