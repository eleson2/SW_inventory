import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeFile(filePath, content) {
  const fullPath = path.join(__dirname, filePath);
  ensureDir(path.dirname(fullPath));
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`✓ Created: ${filePath}`);
}

console.log('🚀 Part 3: Generating Navigation, Layout, and Dashboard...\n');

// =============================================================================
// NAVIGATION COMPONENT
// =============================================================================

writeFile('src/lib/components/navigation/AppNav.svelte', `<script lang="ts">
  import { page } from '$app/stores';
  import { Button } from '$lib/components/ui/button';
  import * as Sheet from '$lib/components/ui/sheet';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { 
    Menu, 
    Home,
    Building2,
    Users,
    Package,
    Layers,
    PackageOpen,
    Box,
    Server,
    Rocket,
    Undo2,
    Settings,
    LayoutList,
    ChevronDown,
    ChevronRight,
    PanelLeftClose,
    PanelLeftOpen
  } from 'lucide-svelte';
  import { browser } from '$app/environment';
  
  let mobileMenuOpen = $state(false);
  let sidebarCollapsed = $state(false);
  let expandedSections = $state<Set<string>>(new Set(['base-data', 'software']));
  
  // Load collapsed state from localStorage on mount
  $effect(() => {
    if (browser) {
      const saved = localStorage.getItem('sidebar-collapsed');
      if (saved !== null) {
        sidebarCollapsed = saved === 'true';
      }
    }
  });
  
  const navigation = [
    {
      section: 'overview',
      title: 'Overview',
      items: [
        { name: 'Dashboard', href: '/', icon: Home }
      ]
    },
    {
      section: 'base-data',
      title: 'Base Data',
      collapsible: true,
      items: [
        { name: 'Vendors', href: '/vendors', icon: Building2 },
        { name: 'Customers', href: '/customers', icon: Users }
      ]
    },
    {
      section: 'software',
      title: 'Software',
      collapsible: true,
      items: [
        { name: 'Products', href: '/products', icon: Package },
        { name: 'Suites', href: '/suites', icon: Layers },
        { name: 'Versions', href: '/versions', icon: PackageOpen },
        { name: 'Packages', href: '/packages', icon: Box }
      ]
    },
    {
      section: 'infrastructure',
      title: 'Infrastructure',
      collapsible: true,
      items: [
        { name: 'LPARs', href: '/lpars', icon: Server }
      ]
    },
    {
      section: 'operations',
      title: 'Operations',
      collapsible: true,
      items: [
        { name: 'Manual Installation', href: '/installations/manual', icon: Rocket },
        { name: 'Package Installation', href: '/installations/package', icon: Box },
        { name: 'Rollback', href: '/installations/rollback', icon: Undo2 }
      ]
    },
    {
      section: 'management',
      title: 'Management',
      collapsible: true,
      items: [
        { name: 'Package Contents', href: '/packages/contents', icon: Settings },
        { name: 'Suite Products', href: '/suites/products', icon: LayoutList }
      ]
    }
  ];
  
  function toggleSection(section: string) {
    const newSet = new Set(expandedSections);
    if (newSet.has(section)) {
      newSet.delete(section);
    } else {
      newSet.add(section);
    }
    expandedSections = newSet;
  }
  
  function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;
    if (browser) {
      localStorage.setItem('sidebar-collapsed', sidebarCollapsed.toString());
    }
  }
  
  function isActive(href: string): boolean {
    if (href === '/') {
      return $page.url.pathname === '/';
    }
    return $page.url.pathname.startsWith(href);
  }
  
  function NavContent() {
    return (
      <ScrollArea class="flex-1 px-3">
        <div class="space-y-4 py-4">
          {#each navigation as section}
            <div>
              {#if section.collapsible && !sidebarCollapsed}
                <button
                  onclick={() => toggleSection(section.section)}
                  class="flex items-center justify-between w-full px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>{section.title}</span>
                  {#if expandedSections.has(section.section)}
                    <ChevronDown class="h-4 w-4" />
                  {:else}
                    <ChevronRight class="h-4 w-4" />
                  {/if}
                </button>
              {:else if !sidebarCollapsed}
                <h3 class="px-3 py-2 text-sm font-semibold text-muted-foreground">
                  {section.title}
                </h3>
              {/if}
              
              {#if !section.collapsible || expandedSections.has(section.section) || sidebarCollapsed}
                <div class="space-y-1 mt-1">
                  {#each section.items as item}
                    {#if sidebarCollapsed}
                      <!-- Collapsed: Show only icon with tooltip -->
                      <Tooltip.Root>
                        <Tooltip.Trigger asChild let:builder>
                          
                            href={item.href}
                            use:builder.action
                            {...builder}
                            class="flex items-center justify-center px-3 py-2 text-sm rounded-md transition-colors
                                   {isActive(item.href) 
                                     ? 'bg-primary text-primary-foreground' 
                                     : 'text-muted-foreground hover:text-foreground hover:bg-accent'}"
                          >
                            <svelte:component this={item.icon} class="h-5 w-5" />
                          </a>
                        </Tooltip.Trigger>
                        <Tooltip.Content side="right">
                          <p>{item.name}</p>
                        </Tooltip.Content>
                      </Tooltip.Root>
                    {:else}
                      <!-- Expanded: Show icon + text -->
                      
                        href={item.href}
                        onclick={() => mobileMenuOpen = false}
                        class="flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors
                               {isActive(item.href) 
                                 ? 'bg-primary text-primary-foreground font-medium' 
                                 : 'text-muted-foreground hover:text-foreground hover:bg-accent'}"
                      >
                        <svelte:component this={item.icon} class="h-4 w-4" />
                        {item.name}
                      </a>
                    {/if}
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </ScrollArea>
    );
  }
</script>

<!-- Desktop Sidebar -->
<div 
  class="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:border-r md:bg-background transition-all duration-300
         {sidebarCollapsed ? 'md:w-16' : 'md:w-64'}"
>
  <!-- Logo/Header -->
  <div class="flex items-center h-16 px-6 border-b {sidebarCollapsed ? 'justify-center px-3' : ''}">
    {#if sidebarCollapsed}
      <a href="/" class="flex items-center">
        <Server class="h-6 w-6 text-primary" />
      </a>
    {:else}
      <a href="/" class="flex items-center gap-2 font-bold text-lg">
        <Server class="h-6 w-6 text-primary" />
        <span>Software Manager</span>
      </a>
    {/if}
  </div>
  
  <!-- Navigation -->
  {@render NavContent()}
  
  <!-- Collapse Toggle Button -->
  <div class="border-t p-3">
    <Button 
      variant="ghost" 
      size="sm" 
      class="w-full {sidebarCollapsed ? 'px-0 justify-center' : 'justify-start'}"
      onclick={toggleSidebar}
    >
      {#if sidebarCollapsed}
        <PanelLeftOpen class="h-4 w-4" />
      {:else}
        <PanelLeftClose class="h-4 w-4 mr-2" />
        <span>Collapse</span>
      {/if}
    </Button>
  </div>
</div>

<!-- Mobile Header -->
<div class="md:hidden fixed top-0 left-0 right-0 h-16 border-b bg-background z-50 flex items-center px-4">
  <Sheet.Root bind:open={mobileMenuOpen}>
    <Sheet.Trigger asChild let:builder>
      <Button builders={[builder]} variant="ghost" size="icon">
        <Menu class="h-6 w-6" />
      </Button>
    </Sheet.Trigger>
    <Sheet.Content side="left" class="w-64 p-0">
      <div class="flex items-center h-16 px-6 border-b">
        <a href="/" class="flex items-center gap-2 font-bold text-lg">
          <Server class="h-6 w-6 text-primary" />
          <span>Software Manager</span>
        </a>
      </div>
      {@render NavContent()}
    </Sheet.Content>
  </Sheet.Root>
  
  <a href="/" class="flex items-center gap-2 font-bold text-lg ml-4">
    <Server class="h-6 w-6 text-primary" />
    <span>Software Manager</span>
  </a>
</div>

<!-- Main Content Area - Adjusts based on sidebar state -->
<div 
  class="pt-16 md:pt-0 transition-all duration-300
         {sidebarCollapsed ? 'md:pl-16' : 'md:pl-64'}"
>
  <slot />
</div>
`);

// =============================================================================
// ROOT LAYOUT
// =============================================================================

writeFile('src/routes/+layout.svelte', `<script lang="ts">
  import '../app.css';
  import AppNav from '$lib/components/navigation/AppNav.svelte';
  import { Toaster } from 'svelte-sonner';
  import { ModeWatcher } from 'mode-watcher';
  
  let { children } = $props();
</script>

<ModeWatcher />
<Toaster richColors />

<AppNav>
  {@render children()}
</AppNav>
`);

// =============================================================================
// DASHBOARD PAGE SERVER
// =============================================================================

writeFile('src/routes/+page.server.ts', `import type { PageServerLoad } from './$types';
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
    db.query(\`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = TRUE) as active
      FROM lpars
    \`),
    
    // Recent installations
    db.query(\`
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
    \`)
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
`);

// =============================================================================
// DASHBOARD PAGE
// =============================================================================

writeFile('src/routes/+page.svelte', `<script lang="ts">
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import * as Table from '$lib/components/ui/table';
  import { 
    Building2, 
    Users, 
    Package, 
    Layers, 
    PackageOpen, 
    Box, 
    Server,
    TrendingUp,
    Activity,
    ArrowRight,
    CheckCircle,
    XCircle
  } from 'lucide-svelte';
  import type { PageData } from './$types';
  
  let { data }: { data: PageData } = $props();
  
  const statCards = [
    {
      title: 'Vendors',
      value: data.stats.vendors,
      icon: Building2,
      href: '/vendors',
      color: 'text-blue-600 dark:text-blue-400'
    },
    {
      title: 'Customers',
      value: data.stats.customers,
      icon: Users,
      href: '/customers',
      color: 'text-green-600 dark:text-green-400'
    },
    {
      title: 'Products',
      value: data.stats.products,
      icon: Package,
      href: '/products',
      color: 'text-purple-600 dark:text-purple-400'
    },
    {
      title: 'Suites',
      value: data.stats.suites,
      icon: Layers,
      href: '/suites',
      color: 'text-orange-600 dark:text-orange-400'
    },
    {
      title: 'Versions',
      value: data.stats.versions,
      icon: PackageOpen,
      href: '/versions',
      color: 'text-pink-600 dark:text-pink-400'
    },
    {
      title: 'Packages',
      value: data.stats.packages,
      icon: Box,
      href: '/packages',
      color: 'text-indigo-600 dark:text-indigo-400'
    }
  ];
</script>

<svelte:head>
  <title>Dashboard - Software Manager</title>
</svelte:head>

<div class="container mx-auto py-8 px-4 space-y-8">
  <!-- Header -->
  <div>
    <h1 class="text-3xl font-bold tracking-tight">Dashboard</h1>
    <p class="text-muted-foreground">
      Overview of your software management system
    </p>
  </div>
  
  <!-- Stats Grid -->
  <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    {#each statCards as stat}
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">
            {stat.title}
          </CardTitle>
          <svelte:component this={stat.icon} class="h-4 w-4 {stat.color}" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{stat.value}</div>
          <a href={stat.href}>
            <Button variant="link" class="px-0 text-xs h-auto mt-1">
              View all <ArrowRight class="h-3 w-3 ml-1" />
            </Button>
          </a>
        </CardContent>
      </Card>
    {/each}
  </div>
  
  <!-- LPARs Overview -->
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <Server class="h-5 w-5" />
        LPARs Overview
      </CardTitle>
      <CardDescription>Logical partition status</CardDescription>
    </CardHeader>
    <CardContent>
      <div class="flex items-center justify-between">
        <div>
          <div class="text-3xl font-bold">{data.stats.lpars.total}</div>
          <p class="text-sm text-muted-foreground">Total LPARs</p>
        </div>
        <div class="text-right">
          <div class="flex items-center gap-2 justify-end">
            <CheckCircle class="h-4 w-4 text-green-600 dark:text-green-400" />
            <span class="text-2xl font-bold">{data.stats.lpars.active}</span>
          </div>
          <p class="text-sm text-muted-foreground">Active</p>
        </div>
        <div class="text-right">
          <div class="flex items-center gap-2 justify-end">
            <XCircle class="h-4 w-4 text-muted-foreground" />
            <span class="text-2xl font-bold">{data.stats.lpars.total - data.stats.lpars.active}</span>
          </div>
          <p class="text-sm text-muted-foreground">Inactive</p>
        </div>
      </div>
      <a href="/lpars" class="block mt-4">
        <Button variant="outline" class="w-full">
          Manage LPARs <ArrowRight class="h-4 w-4 ml-2" />
        </Button>
      </a>
    </CardContent>
  </Card>
  
  <!-- Recent Installations -->
  <Card>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <Activity class="h-5 w-5" />
        Recent Installations
      </CardTitle>
      <CardDescription>Latest software deployments</CardDescription>
    </CardHeader>
    <CardContent>
      {#if data.recentInstallations.length > 0}
        <div class="rounded-md border">
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head>Date</Table.Head>
                <Table.Head>LPAR</Table.Head>
                <Table.Head>Product</Table.Head>
                <Table.Head>Version</Table.Head>
                <Table.Head class="text-center">Status</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each data.recentInstallations as installation}
                <Table.Row>
                  <Table.Cell class="text-sm">
                    {new Date(installation.installed_date).toLocaleDateString()}
                  </Table.Cell>
                  <Table.Cell class="font-medium">
                    {installation.lpar_name}
                  </Table.Cell>
                  <Table.Cell>
                    {installation.product_name}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="secondary" class="font-mono text-xs">
                      {installation.version_string}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell class="text-center">
                    {#if installation.is_active}
                      <Badge variant="default" class="text-xs">
                        <CheckCircle class="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    {:else}
                      <Badge variant="secondary" class="text-xs">
                        <XCircle class="h-3 w-3 mr-1" />
                        Superseded
                      </Badge>
                    {/if}
                  </Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        </div>
      {:else}
        <div class="text-center py-8 text-muted-foreground">
          <Activity class="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No installations yet</p>
          <p class="text-sm">Start by installing software on your LPARs</p>
        </div>
      {/if}
    </CardContent>
  </Card>
  
  <!-- Quick Actions -->
  <Card>
    <CardHeader>
      <CardTitle>Quick Actions</CardTitle>
      <CardDescription>Common tasks and operations</CardDescription>
    </CardHeader>
    <CardContent>
      <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <a href="/installations/manual">
          <Button variant="outline" class="w-full justify-start">
            <TrendingUp class="h-4 w-4 mr-2" />
            Install Software
          </Button>
        </a>
        <a href="/installations/package">
          <Button variant="outline" class="w-full justify-start">
            <Box class="h-4 w-4 mr-2" />
            Deploy Package
          </Button>
        </a>
        <a href="/packages">
          <Button variant="outline" class="w-full justify-start">
            <Package class="h-4 w-4 mr-2" />
            Create Package
          </Button>
        </a>
        <a href="/versions">
          <Button variant="outline" class="w-full justify-start">
            <PackageOpen class="h-4 w-4 mr-2" />
            Add Version
          </Button>
        </a>
        <a href="/lpars">
          <Button variant="outline" class="w-full justify-start">
            <Server class="h-4 w-4 mr-2" />
            Manage LPARs
          </Button>
        </a>
        <a href="/installations/rollback">
          <Button variant="outline" class="w-full justify-start">
            <ArrowRight class="h-4 w-4 mr-2 rotate-180" />
            Rollback
          </Button>
        </a>
      </div>
    </CardContent>
  </Card>
</div>
`);

console.log('\n✅ Part 3 Complete!');
console.log('   - Navigation component');
console.log('   - Root layout');
console.log('   - Dashboard page + server\n');
console.log('📝 Next: Run generate-app-part4.mjs for Entity Pages (Vendors, Customers, Products, etc.)\n');
