<script lang="ts">
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
