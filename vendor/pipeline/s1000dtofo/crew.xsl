<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     S1000D to XSL-FO: Crew/Operator Data Module
     
     Contains templates for processing crew/operator data modules
     (crew.xsd based modules).
     ******************************************************************** -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
  xmlns:fo="http://www.w3.org/1999/XSL/Format"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <!-- ==================================================================== -->
  <!--                    CREW DMODULE TEMPLATE                              -->
  <!-- ==================================================================== -->
  <xsl:template match="dmodule[contains(@xsi:noNamespaceSchemaLocation, 'crew.xsd')]">
    <xsl:call-template name="page-sequence">
      <xsl:with-param name="content">
        <fo:block>
          <!-- Generate markers for headers/footers -->
          <xsl:call-template name="generate-markers"/>
          <!-- Process the content -->
          <fo:block id="content-start-{generate-id()}" padding-bottom="20mm">
            <xsl:apply-templates select="identAndStatusSection/dmAddress/dmAddressItems/dmTitle"/>
            <xsl:apply-templates select="content"/>
          </fo:block>
          <!-- End of data module marker -->
          <fo:block>
            <xsl:call-template name="end-of-datamodule-marker"/>
          </fo:block>
        </fo:block>
      </xsl:with-param>
    </xsl:call-template>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    CREW OPERATIONS                                    -->
  <!-- ==================================================================== -->
  <xsl:template match="crew">
    <fo:block id="{generate-id()}" padding-top="{$standard-leading}">
      <xsl:if test="$show.schema.heading != 0">
        <fo:block xsl:use-attribute-sets="centerhead2">Crew/Operator Information</fo:block>
      </xsl:if>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    CREW DRILL                                         -->
  <!-- ==================================================================== -->
  <xsl:template match="crewDrill">
    <fo:block id="{generate-id()}" padding-top="{$standard-leading}">
      <fo:block xsl:use-attribute-sets="sidehead0">Crew Drill</fo:block>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <xsl:template match="crewDrillStep">
    <fo:block id="{generate-id()}" padding-top="{$standard-leading}">
      <fo:list-block provisional-distance-between-starts="{$inner-type-limit}">
        <fo:list-item>
          <fo:list-item-label end-indent="label-end()">
            <fo:block font-weight="bold">
              <xsl:number count="crewDrillStep" level="multiple" from="crewDrill"/>
              <xsl:text>.</xsl:text>
            </fo:block>
          </fo:list-item-label>
          <fo:list-item-body start-indent="body-start()">
            <fo:block>
              <xsl:apply-templates select="@warningRefs"/>
              <xsl:apply-templates select="@cautionRefs"/>
              <xsl:apply-templates/>
            </fo:block>
          </fo:list-item-body>
        </fo:list-item>
      </fo:list-block>
    </fo:block>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    CHALLENGE/RESPONSE                                 -->
  <!-- ==================================================================== -->
  <xsl:template match="crewProcedureName">
    <fo:block font-weight="bold" padding-top="5pt" font-size="12pt">
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <xsl:template match="challengeResponse">
    <fo:block padding-top="3pt">
      <fo:table table-layout="fixed" width="100%">
        <fo:table-column column-width="proportional-column-width(2)"/>
        <fo:table-column column-width="proportional-column-width(1)"/>
        <fo:table-body>
          <fo:table-row>
            <fo:table-cell padding="2pt">
              <fo:block>
                <xsl:apply-templates select="challenge"/>
              </fo:block>
            </fo:table-cell>
            <fo:table-cell padding="2pt">
              <fo:block text-align="right">
                <xsl:apply-templates select="response"/>
              </fo:block>
            </fo:table-cell>
          </fo:table-row>
        </fo:table-body>
      </fo:table>
    </fo:block>
  </xsl:template>
  <!--
    Scoped to challengeResponse specifically — challengeAndResponse, a
    similarly-named but different wrapper in proced.xsl, has its own
    challenge/response pair with its own (plainer) styling, and a bare
    match="challenge|response" here would have competed with it for every
    challenge and response in the book, decided by include order rather than
    by which wrapper the element was actually inside. A path pattern carries
    a higher default XSLT priority than a bare name test, so this and
    proced.xsl's equivalent now resolve correctly regardless of which
    stylesheet happens to be included first.
  -->
  <xsl:template match="challengeResponse/challenge">
    <fo:inline>
      <xsl:apply-templates/>
      <xsl:text> ..................</xsl:text>
    </fo:inline>
  </xsl:template>
  <xsl:template match="challengeResponse/response">
    <fo:inline font-weight="bold">
      <xsl:apply-templates/>
    </fo:inline>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    CREW MEMBER ROLE                                   -->
  <!-- ==================================================================== -->
  <xsl:template match="crewMemberGroup">
    <fo:block padding-top="{$standard-leading}">
      <fo:block font-weight="bold" font-style="italic">
        <xsl:text>Crew Member: </xsl:text>
        <xsl:value-of select="@crewMemberType"/>
      </fo:block>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    CREW REF CARD                                      -->
  <!-- ==================================================================== -->
  <xsl:template match="crewRefCard">
    <fo:block id="{generate-id()}" padding-top="{$standard-leading}" 
        border="0.5pt solid black" padding="5mm" background-color="#f8f8f8">
      <fo:block xsl:use-attribute-sets="sidehead0">Quick Reference Card</fo:block>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    OPERATOR INSTRUCTIONS                              -->
  <!-- ==================================================================== -->
  <xsl:template match="operatorInstructions">
    <fo:block id="{generate-id()}" padding-top="{$standard-leading}">
      <fo:block xsl:use-attribute-sets="sidehead0">Operator Instructions</fo:block>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <xsl:template match="descrCrew">
    <fo:block padding-top="3pt">
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <xsl:template match="subCrewDrill">
    <fo:block padding-top="{$standard-leading}" padding-left="10mm">
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
</xsl:stylesheet>