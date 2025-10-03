import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async () => {
  // Get summary statistics
  const stats = await Promise.all([
    // Vendors count
    db.query('SELECT COUNT(*) as count FROM vendors'),
    
    // Customers count
    db.query('SELECT COUNT(*) as count FROM customers'),
    
    // Products count
    db.query('SELECT COUNT(*) as count FROM software_products'),
    
    // Suites count
    db.query('SELECT COUNT(*) as count FROM software_suites'),
    
    // Versions count
    db.query('SELECT COUNT(*) as count FROM software_versions'),
    
    // Packages count
    db.query('SELECT COUNT(*) as count FROM software_packages'),
    
    // LPARs count (total and active)
    db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = TRUE) as active
      FROM lpars
    `),
    
    // Recent installations
    db.query(`
      SELECT 
        li.installation_id,
        li.installed_date,
        l.lpar_name,
        p.product_name,
        sv.version_string,
        li.is_active
      FROM lpar_installations li
      JOIN lpars l ON li.lpar_id = l.lpar_id
      JOIN software_versions sv ON li.version_id = sv.version_id
      JOIN software_products p ON sv.product_id = p.product_id
      ORDER BY li.installed_date DESC
      LIMIT 10
    `)
  ]);
  
  return {
    stats: {
      vendors: parseInt(stats[0].rows[0]?.count || 0),
      customers: parseInt(stats[1].rows[0]?.count || 0),
      products: parseInt(stats[2].rows[0]?.count || 0),
      suites: parseInt(stats[3].rows[0]?.count || 0),
      versions: parseInt(stats[4].rows[0]?.count || 0),
      packages: parseInt(stats[5].rows[0]?.count || 0),
      lpars: {
        total: parseInt(stats[6].rows[0]?.total || 0),
        active: parseInt(stats[6].rows[0]?.active || 0)
      }
    },
    recentInstallations: stats[7].rows
  };
};
