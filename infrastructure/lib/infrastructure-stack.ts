import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { NetworkConstruct } from './constructs/network';
import { DatabaseConstruct } from './constructs/database';
import { DatabaseAccessConstruct } from './constructs/database-access';

export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const network = new NetworkConstruct(this, 'Network');

    const database = new DatabaseConstruct(this, 'Database', {
      vpc: network.vpc,
    });

    const databaseAccess = new DatabaseAccessConstruct(
      this,
      'DatabaseAccess',
      {
        vpc: network.vpc,
      },
    );

    database.cluster.connections.allowDefaultPortFrom(
      databaseAccess.instance,
      'Allow PostgreSQL access from SSM database access host',
    );
  }
}
