<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     S1000D to XSL-FO: Procedural Data Module
     
     Contains templates for processing procedural data modules
     (proced.xsd based modules).
     ******************************************************************** -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
  xmlns:fo="http://www.w3.org/1999/XSL/Format"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <!-- ==================================================================== -->
  <!--                    PROCEDURAL DMODULE TEMPLATE                        -->
  <!-- ==================================================================== -->
  <xsl:template match="dmodule[contains(@xsi:noNamespaceSchemaLocation, 'proced.xsd')]">
    <xsl:choose>
      <!--
        A procedure carrying a wide table or illustration marked orient="land"
        is emitted as several page-sequences so only that one page turns
        landscape. Same machinery the descriptive modules use; see
        emit-orientation-runs in descript.xsl.
      -->
      <xsl:when test="content/procedure//*[descendant-or-self::*[@orient='land'] or descendant-or-self::foldout]">
        <xsl:call-template name="page-sequence">
          <xsl:with-param name="last" select="0"/>
          <xsl:with-param name="content">
            <fo:block>
              <xsl:call-template name="generate-markers"/>
              <fo:block id="content-start-{generate-id()}" padding-bottom="20mm">
                <xsl:apply-templates select="identAndStatusSection/dmAddress/dmAddressItems/dmTitle"/>
                <xsl:call-template name="emit-front-matter"/>
              </fo:block>
            </fo:block>
          </xsl:with-param>
        </xsl:call-template>
        <xsl:call-template name="emit-orientation-runs">
          <xsl:with-param name="desc" select="/.."/>
          <xsl:with-param name="nodes" select="content/procedure/*"/>
          <xsl:with-param name="tail" select="/.."/>
          <xsl:with-param name="first" select="0"/>
        </xsl:call-template>
      </xsl:when>
      <xsl:otherwise>
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
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    PROCEDURE TEMPLATE                                 -->
  <!-- ==================================================================== -->
  <xsl:template match="procedure">
    <fo:block>
      <xsl:choose>
        <xsl:when test="@id">
          <xsl:call-template name="copy.id"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:attribute name="id">
            <xsl:value-of select="generate-id()"/>
          </xsl:attribute>
        </xsl:otherwise>
      </xsl:choose>
      <xsl:if test="$show.schema.heading != 0">
        <fo:block xsl:use-attribute-sets="centerhead2">Procedure</fo:block>
      </xsl:if>
      <xsl:apply-templates select="@warningRefs"/>
      <xsl:apply-templates select="@cautionRefs"/>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    MAIN PROCEDURE TEMPLATE                            -->
  <!-- ==================================================================== -->
  <xsl:template match="mainProcedure">
    <fo:block padding-top="{$standard-leading}">
      <xsl:choose>
        <xsl:when test="@id">
          <xsl:call-template name="copy.id"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:attribute name="id">
            <xsl:value-of select="generate-id()"/>
          </xsl:attribute>
        </xsl:otherwise>
      </xsl:choose>
      <xsl:if test="$show.schema.heading != 0">
        <fo:block xsl:use-attribute-sets="centerhead2">Main procedure</fo:block>
      </xsl:if>
      <xsl:apply-templates select="@warningRefs"/>
      <xsl:apply-templates select="@cautionRefs"/>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    PROCEDURAL STEP TEMPLATES                          -->
  <!-- ==================================================================== -->
  <!-- proceduralStep WITH title - title template handles the numbering -->
  <xsl:template match="proceduralStep[title]">
    <fo:block keep-together.within-page="auto">
      <xsl:choose>
        <xsl:when test="@id">
          <xsl:call-template name="copy.id"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:attribute name="id">
            <xsl:value-of select="generate-id()"/>
          </xsl:attribute>
        </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates select="@warningRefs"/>
      <xsl:apply-templates select="@cautionRefs"/>
      <!-- select="*" would drop an authored <?page-break?>: a processing
         instruction is not an element, so the break silently did nothing
         exactly where authors most often want one (between a figure and
         the table that follows it). -->
    <xsl:apply-templates select="*|processing-instruction('page-break')"/>
    </fo:block>
  </xsl:template>
  <!-- proceduralStep WITHOUT title - use list format with number -->
  <xsl:template match="proceduralStep[not(title)]">
    <fo:block keep-together.within-page="auto" padding-top="{$standard-leading}">
      <xsl:choose>
        <xsl:when test="@id">
          <xsl:call-template name="copy.id"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:attribute name="id">
            <xsl:value-of select="generate-id()"/>
          </xsl:attribute>
        </xsl:otherwise>
      </xsl:choose>
      <fo:list-block provisional-distance-between-starts="{$inner-type-limit}">
        <fo:list-item>
          <fo:list-item-label end-indent="label-end()">
            <fo:block font-weight="bold">
              <xsl:apply-templates select="." mode="number"/>
            </fo:block>
          </fo:list-item-label>
          <fo:list-item-body start-indent="body-start()">
            <fo:block>
              <xsl:apply-templates select="@warningRefs"/>
              <xsl:apply-templates select="@cautionRefs"/>
              <xsl:apply-templates select="*[1]"/>
            </fo:block>
          </fo:list-item-body>
        </fo:list-item>
      </fo:list-block>
      <xsl:apply-templates select="*[position() != 1] | processing-instruction('page-break')[preceding-sibling::*]"/>
    </fo:block>
  </xsl:template>
  <xsl:template match="proceduralStep" mode="number">
    <xsl:choose>
      <!-- JSS format: counts from mainProcedure parent with multi-level format -->
      <xsl:when test="contains($document.format, 'JSS')">
        <xsl:number level="multiple" count="mainProcedure | proceduralStep" format="1.1.1"/>
      </xsl:when>
      <xsl:when test="ancestor::proceduralStep">
        <xsl:number count="proceduralStep" level="multiple" from="mainProcedure"/>
      </xsl:when>
      <xsl:otherwise>
        <xsl:number count="proceduralStep" level="single" from="mainProcedure"/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>
  <xsl:template match="proceduralStep" mode="label">
    <xsl:text>Step </xsl:text>
    <xsl:apply-templates select="." mode="number"/>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    PROCEDURAL STEP TITLE                              -->
  <!-- ==================================================================== -->
  <xsl:template match="proceduralStep/title">
    <!-- Nesting depth drives the size, matching levelledPara titles. The
         literal 14pt here sat inside the block carrying the sidehead
         attribute-set and overrode it, so step titles ignored Settings. -->
    <xsl:variable name="step-level" select="count(ancestor::proceduralStep)"/>
    <xsl:variable name="heading-size">
      <xsl:choose>
        <xsl:when test="$step-level = 1"><xsl:value-of select="$heading.1.size"/></xsl:when>
        <xsl:when test="$step-level = 2"><xsl:value-of select="$heading.2.size"/></xsl:when>
        <xsl:when test="$step-level = 3"><xsl:value-of select="$heading.3.size"/></xsl:when>
        <xsl:otherwise><xsl:value-of select="$heading.4.size"/></xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:variable name="content">
      <fo:block font-size="{$heading-size}" font-weight="bold" 
          provisional-distance-between-starts="{$inner-type-limit}">
        <fo:block font-family="{$font-stack}" start-indent="0pt" keep-with-next.within-page="always">
          <fo:table table-layout="fixed" width="100%">
            <fo:table-column column-width="{$inner-type-limit}"/>
            <fo:table-column column-width="proportional-column-width(1)"/>
            <fo:table-body>
              <fo:table-row>
                <fo:table-cell>
                  <fo:block>
                    <xsl:apply-templates select="parent::*" mode="number"/>
                  </fo:block>
                </fo:table-cell>
                <fo:table-cell>
                  <fo:block>
                    <xsl:apply-templates/>
                  </fo:block>
                </fo:table-cell>
              </fo:table-row>
            </fo:table-body>
          </fo:table>
        </fo:block>
      </fo:block>
    </xsl:variable>
    <xsl:variable name="level" select="count(ancestor::proceduralStep)"/>
    <xsl:choose>
      <xsl:when test="$level = 1">
        <fo:block xsl:use-attribute-sets="sidehead1">
          <xsl:copy-of select="$content"/>
        </fo:block>
      </xsl:when>
      <xsl:when test="$level = 2">
        <fo:block xsl:use-attribute-sets="sidehead2">
          <xsl:copy-of select="$content"/>
        </fo:block>
      </xsl:when>
      <xsl:when test="$level = 3">
        <fo:block xsl:use-attribute-sets="sidehead3">
          <xsl:copy-of select="$content"/>
        </fo:block>
      </xsl:when>
      <xsl:otherwise>
        <fo:block xsl:use-attribute-sets="sidehead4">
          <xsl:copy-of select="$content"/>
        </fo:block>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>
  <!--
    crewDrillStep's real definition is in crew.xsl, scoped by number
    ("level='multiple' from='crewDrill'") to the crewDrill it always belongs
    to — crewDrill is only ever templated there, so nothing outside crew.xsl
    ever produces a crewDrillStep to render. A second, near-identical copy
    lived here (same list-block shape, same @warningRefs/@cautionRefs
    handling, only the numbering differed) and had never once run: crew.xsl
    is included after this file, so its version has always won. Removed,
    along with its own now-orphaned mode="number" companion, which nothing
    else called either.
  -->
  <!-- ==================================================================== -->
  <!--                    CHALLENGE AND RESPONSE                             -->
  <!-- ==================================================================== -->
  <xsl:template match="challengeAndResponse">
    <fo:table table-layout="fixed" width="100%" border-collapse="collapse">
      <fo:table-column column-width="proportional-column-width(1)"/>
      <fo:table-column column-width="proportional-column-width(1)"/>
      <fo:table-body>
        <fo:table-row>
          <fo:table-cell padding="2mm">
            <fo:block font-weight="bold">
              <xsl:apply-templates select="challenge"/>
            </fo:block>
          </fo:table-cell>
          <fo:table-cell padding="2mm">
            <fo:block>
              <xsl:apply-templates select="response"/>
            </fo:block>
          </fo:table-cell>
        </fo:table-row>
      </fo:table-body>
    </fo:table>
  </xsl:template>
  <!--
    Scoped to challengeAndResponse specifically, not a bare challenge|response
    — crew.xsl's challengeResponse (no "And") wraps its own challenge/response
    pair in a QRC-style dotted-leader format, and a bare match here would have
    competed with that pair for every challenge and response in the book,
    decided by include order rather than by which wrapper the element was
    actually inside. See the matching note in crew.xsl.
  -->
  <xsl:template match="challengeAndResponse/challenge|challengeAndResponse/response">
    <xsl:apply-templates/>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    IF/CASE CONSTRUCTS                                 -->
  <!-- ==================================================================== -->
  <xsl:template match="if">
    <fo:block padding-top="{$standard-leading}">
      <fo:block font-weight="bold">IF:</fo:block>
      <fo:block margin-left="10mm">
        <xsl:apply-templates select="*|processing-instruction('page-break')"/>
      </fo:block>
    </fo:block>
  </xsl:template>
  <xsl:template match="case">
    <fo:block padding-top="{$standard-leading}">
      <xsl:apply-templates select="caseCond"/>
      <xsl:apply-templates select="caseCond/following-sibling::*"/>
    </fo:block>
  </xsl:template>
  <xsl:template match="caseCond">
    <fo:block font-weight="bold">
      <xsl:text>CASE </xsl:text>
      <xsl:number count="case" level="single"/>
      <xsl:text>: </xsl:text>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <xsl:template match="elseIf">
    <fo:block padding-top="{$standard-leading}">
      <fo:block font-weight="bold">ELSE IF:</fo:block>
      <fo:block margin-left="10mm">
        <xsl:apply-templates select="*|processing-instruction('page-break')"/>
      </fo:block>
    </fo:block>
  </xsl:template>
  <xsl:template match="then">
    <fo:block padding-top="5pt">
      <fo:block font-weight="bold">THEN:</fo:block>
      <fo:block margin-left="10mm">
        <xsl:apply-templates select="*|processing-instruction('page-break')"/>
      </fo:block>
    </fo:block>
  </xsl:template>
  <xsl:template match="else">
    <fo:block padding-top="5pt">
      <fo:block font-weight="bold">ELSE:</fo:block>
      <fo:block margin-left="10mm">
        <xsl:apply-templates select="*|processing-instruction('page-break')"/>
      </fo:block>
    </fo:block>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    SKILL LEVEL                                        -->
  <!-- ==================================================================== -->
  <xsl:template match="skillLevel">
    <fo:inline>
      <xsl:value-of select="@skillLevelCode"/>
    </fo:inline>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    PERSON CATEGORY                                    -->
  <!-- ==================================================================== -->
  <xsl:template match="personCategoryCode">
    <fo:inline>
      <xsl:value-of select="@personCategoryCode"/>
    </fo:inline>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    TIME ESTIMATE                                      -->
  <!-- ==================================================================== -->
  <xsl:template match="timeLimit">
    <fo:inline>
      <xsl:value-of select="@timeLimitValue"/>
      <xsl:text> </xsl:text>
      <xsl:value-of select="@timeLimitUnitOfMeasure"/>
    </fo:inline>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    WORK AREA                                          -->
  <!-- ==================================================================== -->
  <xsl:template match="workAreaLocationGroup">
    <fo:block padding-top="{$standard-leading}">
      <fo:block xsl:use-attribute-sets="sidehead4">Work Area</fo:block>
      <fo:block>
        <xsl:apply-templates/>
      </fo:block>
    </fo:block>
  </xsl:template>
  <xsl:template match="workLocation">
    <fo:block>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    ZONE REFERENCE                                     -->
  <!-- ==================================================================== -->
  <xsl:template match="zoneRef">
    <fo:inline>
      <xsl:text>Zone </xsl:text>
      <xsl:value-of select="@zoneNumber"/>
    </fo:inline>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    ACCESS REFERENCE                                   -->
  <!-- ==================================================================== -->
  <xsl:template match="accessPointRef">
    <fo:inline>
      <xsl:text>Access Point </xsl:text>
      <xsl:value-of select="@accessPointNumber"/>
    </fo:inline>
  </xsl:template>
  <!-- ==================================================================== -->
  <!--                    PERSON REQUIRED                                    -->
  <!-- ==================================================================== -->
  <xsl:template match="personRequired">
    <fo:block>
      <xsl:value-of select="@numRequired"/>
      <xsl:text> person(s): </xsl:text>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>
</xsl:stylesheet>