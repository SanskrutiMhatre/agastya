<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     S1000D to XSL-FO: Illustrated Parts Data (IPD) Module
     
     Contains templates for processing S1000D IPD data modules
     (Illustrated Parts Catalog).
     ******************************************************************** -->

<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
  xmlns:fo="http://www.w3.org/1999/XSL/Format"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xlink="http://www.w3.org/1999/xlink">

  <!-- ==================================================================== -->
  <!--                    IPD ATTRIBUTE SETS                                 -->
  <!-- ==================================================================== -->
  <xsl:attribute-set name="ipd-table">
    <xsl:attribute name="table-layout">fixed</xsl:attribute>
    <xsl:attribute name="width">100%</xsl:attribute>
    <xsl:attribute name="border-collapse">collapse</xsl:attribute>
    <xsl:attribute name="border">0.5pt solid black</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="ipd-header-cell">
    <xsl:attribute name="border">0.5pt solid black</xsl:attribute>
    <xsl:attribute name="padding">2pt 4pt</xsl:attribute>
    <xsl:attribute name="background-color">#E8E8E8</xsl:attribute>
    <xsl:attribute name="font-weight">bold</xsl:attribute>
    <xsl:attribute name="text-align">center</xsl:attribute>
    <xsl:attribute name="font-size">8pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="ipd-cell">
    <xsl:attribute name="border">0.5pt solid black</xsl:attribute>
    <xsl:attribute name="padding">2pt 4pt</xsl:attribute>
    <xsl:attribute name="font-size">8pt</xsl:attribute>
  </xsl:attribute-set>

  <xsl:attribute-set name="ipd-cell-center">
    <xsl:attribute name="border">0.5pt solid black</xsl:attribute>
    <xsl:attribute name="padding">2pt 4pt</xsl:attribute>
    <xsl:attribute name="text-align">center</xsl:attribute>
    <xsl:attribute name="font-size">8pt</xsl:attribute>
  </xsl:attribute-set>

  <!-- ==================================================================== -->
  <!--                    IPD DMODULE TEMPLATE                               -->
  <!-- ==================================================================== -->
  <xsl:template match="dmodule[contains(@xsi:noNamespaceSchemaLocation, 'ipd.xsd')]">
    <fo:page-sequence master-reference="body">
      <!-- Header -->
      <fo:static-content flow-name="xsl-region-before-odd">
        <xsl:call-template name="header-odd"/>
      </fo:static-content>
      <fo:static-content flow-name="xsl-region-before-even">
        <xsl:call-template name="header-even"/>
      </fo:static-content>
      
      <!-- Footer -->
      <fo:static-content flow-name="xsl-region-after-odd">
        <xsl:call-template name="footer-odd"/>
      </fo:static-content>
      <fo:static-content flow-name="xsl-region-after-even">
        <xsl:call-template name="footer-even"/>
      </fo:static-content>
      
      <!-- Body content -->
      <fo:flow flow-name="xsl-region-body" font-family="{$font-stack}" font-size="{$font-size}" text-align="justify">
        <xsl:call-template name="generate-markers"/>
        <fo:block id="content-start-{generate-id()}" padding-bottom="20mm">
          <!-- Title block -->
          <xsl:apply-templates select="identAndStatusSection/dmAddress/dmAddressItems/dmTitle"/>
          
          <!-- Table of contents -->
          <xsl:call-template name="ipd-toc"/>
          
          <!-- List of figures -->
          <xsl:call-template name="ipd-lof"/>
          
          <!-- Illustrated Parts Catalog content -->
          <xsl:apply-templates select="content/illustratedPartsCatalog"/>
        </fo:block>
        <fo:block>
          <xsl:call-template name="end-of-datamodule-marker"/>
        </fo:block>
      </fo:flow>
    </fo:page-sequence>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    IPD TABLE OF CONTENTS                              -->
  <!-- ==================================================================== -->
  <xsl:template name="ipd-toc">
    <fo:block break-after="page" id="ipd-toc">
      <fo:block xsl:use-attribute-sets="sidehead1">Table of Contents</fo:block>
      <fo:block start-indent="10mm" space-before="10pt">
        <!-- List of Figures entry -->
        <xsl:if test=".//figure">
          <fo:block text-align-last="justify" space-before="4pt">
            <fo:basic-link internal-destination="ipd-lof" color="{$color-link}">
              List of Figures
            </fo:basic-link>
            <fo:leader leader-pattern="dots"/>
            <fo:page-number-citation ref-id="ipd-lof"/>
          </fo:block>
        </xsl:if>
        <!-- Illustrated Parts List entry -->
        <fo:block text-align-last="justify" space-before="4pt">
          <fo:basic-link internal-destination="ipd-parts-list" color="{$color-link}">
            Illustrated Parts List
          </fo:basic-link>
          <fo:leader leader-pattern="dots"/>
          <fo:page-number-citation ref-id="ipd-parts-list"/>
        </fo:block>
      </fo:block>
    </fo:block>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    IPD LIST OF FIGURES                                -->
  <!-- ==================================================================== -->
  <xsl:template name="ipd-lof">
    <xsl:if test=".//figure">
      <fo:block break-after="page" id="ipd-lof">
        <fo:block xsl:use-attribute-sets="sidehead1">List of Figures</fo:block>
        <fo:block start-indent="10mm" space-before="10pt">
          <xsl:for-each select=".//figure">
            <fo:block text-align-last="justify" space-before="4pt">
              <fo:basic-link internal-destination="ipd-fig-{generate-id()}" color="{$color-link}">
                <xsl:text>Figure </xsl:text>
                <xsl:number count="figure" level="any" from="illustratedPartsCatalog"/>
                <xsl:text> - </xsl:text>
                <xsl:value-of select="title"/>
              </fo:basic-link>
              <fo:leader leader-pattern="dots"/>
              <fo:page-number-citation ref-id="ipd-fig-{generate-id()}"/>
            </fo:block>
          </xsl:for-each>
        </fo:block>
      </fo:block>
    </xsl:if>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    ILLUSTRATED PARTS CATALOG                          -->
  <!-- ==================================================================== -->
  <xsl:template match="illustratedPartsCatalog">
    <fo:block id="ipd-parts-list">
      <!-- Process figures first -->
      <xsl:apply-templates select="figure"/>
      
      <!-- Parts List Table -->
      <fo:block break-before="page">
        <fo:block xsl:use-attribute-sets="sidehead1" keep-with-next="always">
          Illustrated Parts List
        </fo:block>
        
        <fo:block space-before="10pt">
          <fo:table xsl:use-attribute-sets="ipd-table">
            <!-- Column definitions -->
            <fo:table-column column-width="8%"/>   <!-- FIG -->
            <fo:table-column column-width="7%"/>   <!-- ITEM -->
            <fo:table-column column-width="35%"/>  <!-- PART NUMBER -->
            <fo:table-column column-width="6%"/>   <!-- CAGE -->
            <fo:table-column column-width="34%"/>  <!-- NOMENCLATURE -->
            <fo:table-column column-width="10%"/> <!-- QTY -->
            
            <!-- Table header -->
            <fo:table-header>
              <fo:table-row keep-with-next="always">
                <fo:table-cell xsl:use-attribute-sets="ipd-header-cell">
                  <fo:block>FIG.</fo:block>
                </fo:table-cell>
                <fo:table-cell xsl:use-attribute-sets="ipd-header-cell">
                  <fo:block>ITEM</fo:block>
                </fo:table-cell>
                <fo:table-cell xsl:use-attribute-sets="ipd-header-cell">
                  <fo:block>PART NUMBER</fo:block>
                </fo:table-cell>
                <fo:table-cell xsl:use-attribute-sets="ipd-header-cell">
                  <fo:block>CAGE</fo:block>
                </fo:table-cell>
                <fo:table-cell xsl:use-attribute-sets="ipd-header-cell">
                  <fo:block>NOMENCLATURE</fo:block>
                </fo:table-cell>
                <fo:table-cell xsl:use-attribute-sets="ipd-header-cell">
                  <fo:block>QTY</fo:block>
                </fo:table-cell>
              </fo:table-row>
            </fo:table-header>
            
            <!-- Table body -->
            <fo:table-body>
              <xsl:apply-templates select="catalogSeqNumber" mode="ipd-table"/>
            </fo:table-body>
          </fo:table>
        </fo:block>
      </fo:block>
    </fo:block>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    IPD FIGURE                                         -->
  <!-- ==================================================================== -->
  <xsl:template match="illustratedPartsCatalog/figure">
    <fo:block id="ipd-fig-{generate-id()}" break-before="page" keep-together.within-page="always">
      <!-- Figure title -->
      <fo:block xsl:use-attribute-sets="centerhead2" space-after="10pt">
        <xsl:text>Figure </xsl:text>
        <xsl:number count="figure" level="any" from="illustratedPartsCatalog"/>
        <xsl:text> - </xsl:text>
        <xsl:value-of select="title"/>
      </fo:block>
      
      <!-- Process graphics -->
      <xsl:apply-templates select="graphic"/>
    </fo:block>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    CATALOG SEQUENCE NUMBER                            -->
  <!-- ==================================================================== -->
  <xsl:template match="catalogSeqNumber" mode="ipd-table">
    <xsl:variable name="fig-num" select="@figureNumber"/>
    <xsl:variable name="item-num" select="@item"/>
    <xsl:variable name="indenture" select="@indenture"/>
    
    <xsl:for-each select="itemSeqNumber">
      <fo:table-row keep-together.within-page="always">
        <!-- FIG column -->
        <fo:table-cell xsl:use-attribute-sets="ipd-cell-center">
          <fo:block>
            <xsl:value-of select="$fig-num"/>
          </fo:block>
        </fo:table-cell>
        
        <!-- ITEM column with indenture -->
        <fo:table-cell xsl:use-attribute-sets="ipd-cell-center">
          <fo:block>
            <xsl:call-template name="ipd-indenture">
              <xsl:with-param name="level" select="$indenture"/>
            </xsl:call-template>
            <xsl:value-of select="$item-num"/>
          </fo:block>
        </fo:table-cell>
        
        <!-- PART NUMBER column -->
        <fo:table-cell xsl:use-attribute-sets="ipd-cell">
          <fo:block font-family="{$monospace-stack}">
            <xsl:value-of select="partRef/@partNumberValue"/>
          </fo:block>
          <!-- Show generic part data if present -->
          <xsl:if test="genericPartDataGroup/genericPartData">
            <fo:block font-size="7pt" font-style="italic" color="#666666">
              <xsl:value-of select="genericPartDataGroup/genericPartData/@genericPartDataName"/>
            </fo:block>
          </xsl:if>
        </fo:table-cell>
        
        <!-- CAGE column -->
        <fo:table-cell xsl:use-attribute-sets="ipd-cell-center">
          <fo:block font-family="{$monospace-stack}">
            <xsl:value-of select="partRef/@manufacturerCodeValue"/>
          </fo:block>
        </fo:table-cell>
        
        <!-- NOMENCLATURE column -->
        <fo:table-cell xsl:use-attribute-sets="ipd-cell">
          <fo:block>
            <xsl:apply-templates select="partSegment"/>
            <xsl:apply-templates select="partLocationSegment"/>
            <xsl:apply-templates select="locationRcmdSegment"/>
          </fo:block>
        </fo:table-cell>
        
        <!-- QTY column -->
        <fo:table-cell xsl:use-attribute-sets="ipd-cell-center">
          <fo:block>
            <xsl:value-of select="quantityPerNextHigherAssy"/>
          </fo:block>
        </fo:table-cell>
      </fo:table-row>
    </xsl:for-each>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    INDENTURE INDICATOR                                -->
  <!-- ==================================================================== -->
  <xsl:template name="ipd-indenture">
    <xsl:param name="level"/>
    <xsl:if test="$level and $level > 1">
      <xsl:call-template name="ipd-indent-dots">
        <xsl:with-param name="count" select="$level - 1"/>
      </xsl:call-template>
    </xsl:if>
  </xsl:template>

  <xsl:template name="ipd-indent-dots">
    <xsl:param name="count"/>
    <xsl:if test="$count > 0">
      <xsl:text>.</xsl:text>
      <xsl:call-template name="ipd-indent-dots">
        <xsl:with-param name="count" select="$count - 1"/>
      </xsl:call-template>
    </xsl:if>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    ITEM SEQUENCE NUMBER                               -->
  <!-- ==================================================================== -->
  <xsl:template match="itemSeqNumber">
    <!-- This is handled in the catalogSeqNumber template -->
    <xsl:apply-templates/>
  </xsl:template>

  <!--
    partRef's real definition is in common.xsl, with supplyRef and spareRef —
    honouring $part.no.prefix and the manufacturer code, which a second copy
    here did not. See the comment there.
  -->
  <!-- ==================================================================== -->
  <!--                    PART SEGMENT                                       -->
  <!-- ==================================================================== -->
  <xsl:template match="partSegment">
    <xsl:apply-templates select="itemIdentData"/>
  </xsl:template>

  <xsl:template match="itemIdentData">
    <xsl:apply-templates select="descrForPart"/>
  </xsl:template>

  <xsl:template match="descrForPart">
    <fo:block>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    QUANTITY PER NEXT HIGHER ASSEMBLY                  -->
  <!-- ==================================================================== -->
  <xsl:template match="quantityPerNextHigherAssy">
    <fo:inline>
      <xsl:apply-templates/>
    </fo:inline>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    GENERIC PART DATA                                  -->
  <!-- ==================================================================== -->
  <xsl:template match="genericPartDataGroup">
    <fo:block font-size="7pt" font-style="italic">
      <xsl:apply-templates select="genericPartData"/>
    </fo:block>
  </xsl:template>

  <xsl:template match="genericPartData">
    <fo:inline>
      <xsl:value-of select="@genericPartDataName"/>
      <xsl:if test="genericPartDataValue and normalize-space(genericPartDataValue)">
        <xsl:text>: </xsl:text>
        <xsl:value-of select="genericPartDataValue"/>
      </xsl:if>
    </fo:inline>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    REASON FOR SELECTION                               -->
  <!-- ==================================================================== -->
  <xsl:template match="reasonForSelection">
    <!-- Usually not displayed, just used for data purposes -->
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    PART LOCATION SEGMENT                              -->
  <!-- ==================================================================== -->
  <xsl:template match="partLocationSegment">
    <xsl:if test="*">
      <fo:block font-size="8pt" space-before="2pt">
        <xsl:apply-templates/>
      </fo:block>
    </xsl:if>
  </xsl:template>

  <xsl:template match="descrForLocation">
    <fo:inline font-style="italic">
      <xsl:apply-templates/>
    </fo:inline>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    LOCATION RCMD SEGMENT                              -->
  <!-- ==================================================================== -->
  <xsl:template match="locationRcmdSegment">
    <xsl:if test="*">
      <fo:block font-size="7pt" space-before="2pt">
        <xsl:apply-templates/>
      </fo:block>
    </xsl:if>
  </xsl:template>

  <xsl:template match="locationRcmd">
    <fo:inline>
      <xsl:apply-templates/>
    </fo:inline>
  </xsl:template>

  <xsl:template match="service">
    <fo:inline font-weight="bold">Service: </fo:inline>
    <xsl:value-of select="."/>
    <xsl:text>  </xsl:text>
  </xsl:template>

  <xsl:template match="sourceMaintRecoverability">
    <fo:inline font-weight="bold">SMR: </fo:inline>
    <xsl:value-of select="."/>
    <xsl:text>  </xsl:text>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    ADDITIONAL IPD ELEMENTS                            -->
  <!-- ==================================================================== -->
  
  <!-- Attaching parts -->
  <xsl:template match="attachingParts">
    <fo:block font-size="8pt" font-style="italic">
      <xsl:text>Attaching parts: </xsl:text>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>

  <!-- Bulk item group -->
  <xsl:template match="bulkItemGroup">
    <fo:block>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>

  <!-- Detail item group -->
  <xsl:template match="detailItemGroup">
    <fo:block>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>

  <!-- Functional item group -->
  <xsl:template match="functionalItemGroup">
    <fo:block>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>

  <!-- Kit item group -->
  <xsl:template match="kitItemGroup">
    <fo:block>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>

  <!-- Wiring data group -->
  <xsl:template match="wiringDataGroup">
    <fo:block>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>

  <!-- Effectivity segment -->
  <xsl:template match="effectivitySegment">
    <fo:block font-size="8pt" font-style="italic">
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>

  <!-- Reference designator -->
  <xsl:template match="refDesignator">
    <fo:inline>
      <xsl:text>Ref: </xsl:text>
      <xsl:value-of select="@refDesValue"/>
    </fo:inline>
  </xsl:template>

  <!-- Unit of issue -->
  <xsl:template match="unitOfIssue">
    <fo:inline>
      <xsl:text> </xsl:text>
      <xsl:apply-templates/>
    </fo:inline>
  </xsl:template>

</xsl:stylesheet>
