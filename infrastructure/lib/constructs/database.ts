import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';

export interface DatabaseConstructProps {
  vpc: ec2.IVpc;
}

export class DatabaseConstruct extends Construct {
  public readonly cluster: rds.DatabaseCluster;

      constructor(scope: Construct, id: string, props: DatabaseConstructProps) {
        super(scope, id);

      this.cluster = new rds.DatabaseCluster(this, 'AuroraPostgres', {
        engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_17_4,
      }),
      credentials: rds.Credentials.fromGeneratedSecret('aea_admin', {
       secretName: 'aea/sandbox/database/admin',
      }),  
       iamAuthentication: true,
      writer: rds.ClusterInstance.serverlessV2('writer'),


      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 2,

      vpc: props.vpc,

      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },

      defaultDatabaseName: 'aea',
      storageEncrypted: true,
     
    });
  }
}
