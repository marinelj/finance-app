// Bundled SQL sources share the journal used by native and web startup.
import journal from './meta/_journal.json';
import m0000 from './0000_init.sql';
import m0001 from './0001_portfolio_inputs.sql';
import m0002 from './0002_net_worth_snapshots.sql';
import m0003 from './0003_bill_delivery.sql';
import m0004 from './0004_bill_statements.sql';
import m0005 from './0005_courtesy_days.sql';

export default { journal, migrations: { m0000, m0001, m0002, m0003, m0004, m0005 } };
