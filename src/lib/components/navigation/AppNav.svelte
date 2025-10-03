<script lang="ts">
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
