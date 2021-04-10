import * as cdk from "@aws-cdk/core";
import * as sfn from "@aws-cdk/aws-stepfunctions";
import * as apigateway from "@aws-cdk/aws-apigateway";
import * as iam from "@aws-cdk/aws-iam";

export class CdkstepfunctionsApigwStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const PREFIX_NAME = id.toLowerCase().replace("stack", "")
    const APIKEY_VALUE = '12345678901234567890' // 20字以上
    
    // state machine
    
    const task = new sfn.Wait(this, "task", {
      time: sfn.WaitTime.duration(cdk.Duration.seconds(5)),
    })
    
    const definition = task

    const state_machine = new sfn.StateMachine(this, "state_machine", {
      definition,
      timeout: cdk.Duration.seconds(10),
      stateMachineName: PREFIX_NAME + "-statemachine",
    })
    
    // iam role
    
    var role = new iam.Role(this, "role", {
      roleName: PREFIX_NAME + "-role",
      assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com')
    })
    
    state_machine.grantStartExecution(role)
    
    // api
    
    const aws_integration = new apigateway.AwsIntegration({
      service: 'states',
      action: 'StartExecution',
      options: {
        credentialsRole: role,
        passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
        requestTemplates: {
          'application/json': JSON.stringify({
            stateMachineArn: state_machine.stateMachineArn,
            input: "$util.escapeJavaScript($input.json('$'))"
          })
        },
        integrationResponses: [{
          selectionPattern: '200',
          statusCode: '200',
          responseTemplates: {
            'application/json': "$input.json('$')"
          }
        }]
      }
    })
    
    const api = new apigateway.RestApi(this, 'api', {
      restApiName: PREFIX_NAME + "-api",
    })
    
    api.root.addMethod('GET', aws_integration, {
      apiKeyRequired: true,
      methodResponses: [{
        statusCode: '200',
        responseModels: {
          'application/json': new apigateway.EmptyModel()
        }
      }]}
    )
    
    // add appkey and plan
    
    const apikey = api.addApiKey('apikey', {
      apiKeyName: PREFIX_NAME + '-apikey', // 削除してくれない?
      value: APIKEY_VALUE, // 20字以上
    })
    
    const plan = api.addUsagePlan('usageplan', {
      name: 'plan',
      apiKey: apikey,
      throttle: {
        rateLimit: 1,
        burstLimit: 1
      },
      quota: {
        limit: 20,
        period: apigateway.Period.DAY
      }
    })
    
    plan.addApiStage({
      stage: api.deploymentStage
    })
    
    new cdk.CfnOutput(this, 'output', {
      value: APIKEY_VALUE
    })
  }
}
