<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     S1000D to XSL-FO: Front Matter

     Handles frontmatter.xsd and descript.xsd title-page DMs.
     Also provides record-of-revisions named template.
     ******************************************************************** -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
  xmlns:fo="http://www.w3.org/1999/XSL/Format"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">

  <!-- ==================================================================== -->
  <!--   FRONTMATTER.XSD DMODULE (priority 10)                              -->
  <!--   Handles: frontMatter, frontMatterTitlePage, publisherLogo          -->
  <!-- ==================================================================== -->
  <xsl:template match="dmodule[contains(@xsi:noNamespaceSchemaLocation,'frontmatter.xsd')]"
                priority="10">
    <xsl:call-template name="page-sequence">
      <xsl:with-param name="content">
        <fo:block>
          <xsl:call-template name="generate-markers"/>
          <xsl:apply-templates select="content/frontMatter"/>
          <fo:block>
            <xsl:call-template name="end-of-datamodule-marker"/>
          </fo:block>
        </fo:block>
      </xsl:with-param>
    </xsl:call-template>
  </xsl:template>

  <xsl:template match="frontMatter">
    <xsl:apply-templates select="frontMatterTitlePage"/>
    <xsl:apply-templates select="frontMatterInfo"/>
    <xsl:apply-templates select="*[not(self::frontMatterTitlePage)][not(self::frontMatterInfo)]"/>
  </xsl:template>

  <xsl:template match="frontMatterTitlePage">
    <fo:block break-after="page" text-align="center">
      <!-- Publisher logo (left side via block) -->
      <fo:block padding-top="30mm">
        <xsl:apply-templates select="publisherLogo"/>
      </fo:block>
      <!-- Product name -->
      <fo:block font-size="24pt" font-weight="bold" padding-top="20mm">
        <xsl:value-of select="ancestor::dmodule/identAndStatusSection/dmAddress/dmAddressItems/dmTitle/techName"/>
      </fo:block>
      <!-- Info name -->
      <xsl:if test="ancestor::dmodule/identAndStatusSection/dmAddress/dmAddressItems/dmTitle/infoName">
        <fo:block font-size="16pt" padding-top="6mm" color="#444444">
          <xsl:value-of select="ancestor::dmodule/identAndStatusSection/dmAddress/dmAddressItems/dmTitle/infoName"/>
        </fo:block>
      </xsl:if>
      <!-- Divider -->
      <fo:block padding-top="15mm">
        <fo:leader leader-pattern="rule" rule-thickness="0.5pt"
                   leader-length="80mm" color="#888888"/>
      </fo:block>
      <!-- Issue -->
      <fo:block font-size="11pt" padding-top="8mm">
        <xsl:text>Issue&#xA0;</xsl:text>
        <xsl:value-of select="ancestor::dmodule/identAndStatusSection/dmAddress/dmIdent/issueInfo/@issueNumber"/>
        <xsl:text>&#x2013;</xsl:text>
        <xsl:value-of select="ancestor::dmodule/identAndStatusSection/dmAddress/dmIdent/issueInfo/@inWork"/>
      </fo:block>
      <!-- Date -->
      <fo:block font-size="11pt" padding-top="4mm">
        <xsl:value-of select="ancestor::dmodule/identAndStatusSection/dmAddress/dmAddressItems/issueDate/@year"/>
        <xsl:text>-</xsl:text>
        <xsl:value-of select="ancestor::dmodule/identAndStatusSection/dmAddress/dmAddressItems/issueDate/@month"/>
        <xsl:text>-</xsl:text>
        <xsl:value-of select="ancestor::dmodule/identAndStatusSection/dmAddress/dmAddressItems/issueDate/@day"/>
      </fo:block>
      <!-- Company -->
      <xsl:variable name="company">
        <xsl:choose>
          <xsl:when test="responsiblePartnerCompany/enterpriseName">
            <xsl:value-of select="responsiblePartnerCompany/enterpriseName"/>
          </xsl:when>
          <xsl:otherwise>
            <xsl:value-of select="ancestor::dmodule/identAndStatusSection/dmStatus/responsiblePartnerCompany/enterpriseName"/>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:variable>
      <xsl:if test="normalize-space($company)">
        <fo:block font-size="11pt" padding-top="30mm" color="#333333">
          <xsl:value-of select="$company"/>
        </fo:block>
      </xsl:if>
    </fo:block>
  </xsl:template>

  <!-- publisherLogo: logo inside frontmatter.xsd title page -->
  <xsl:template match="publisherLogo">
    <xsl:if test="symbol/@infoEntityIdent">
      <fo:external-graphic
          src="{unparsed-entity-uri(symbol/@infoEntityIdent)}"
          content-height="25mm"
          content-width="scale-to-fit"
          scaling="uniform"/>
    </xsl:if>
  </xsl:template>

  <!-- frontMatterInfo: general info pages (data restrictions, etc.) -->
  <xsl:template match="frontMatterInfo">
    <fo:block break-before="page">
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>

  <!-- ====================================================================
       infoCode 001 ("Title page") modules are rendered by the ordinary
       dmodule template in descript.xsl, not specially.

       There used to be a priority-5 template here that turned every one of
       them into a centred title page built from the PUBLICATION's metadata.
       Two things were wrong with it. This application always injects its own
       settings-driven front matter, so the page was redundant — it surfaced
       mid-document, titled "Untitled PM", wherever a 001 module happened to
       sit in the publication. Worse, it never applied templates to the
       module's own <content>: a 001 module carrying real text (a warranty
       certificate, in the case that exposed this) had that text silently
       replaced by the boilerplate page.

       Removing it means such a module renders its real title and content
       like any other.
       ==================================================================== -->

  <!-- ==================================================================== -->
  <!--   LIST OF EFFECTIVE DATA MODULES (LOEDM) infoCode 00S (priority 5) -->
  <!--   Auto-generates a table of all dmodules in the publication.         -->
  <!-- ==================================================================== -->
  <xsl:template match="dmodule[identAndStatusSection/dmAddress/dmIdent/dmCode/@infoCode='00S']"
                priority="5">
    <xsl:call-template name="page-sequence">
      <xsl:with-param name="content">
        <fo:block>
          <xsl:call-template name="generate-markers"/>
          <fo:block id="content-start-{generate-id()}">
            <fo:block xsl:use-attribute-sets="centerhead1">
              <xsl:value-of select="identAndStatusSection/dmAddress/dmAddressItems/dmTitle/techName"/>
              <xsl:if test="identAndStatusSection/dmAddress/dmAddressItems/dmTitle/infoName">
                <xsl:text> - </xsl:text>
                <xsl:value-of select="identAndStatusSection/dmAddress/dmAddressItems/dmTitle/infoName"/>
              </xsl:if>
            </fo:block>
            <fo:table table-layout="fixed" width="100%" border-collapse="collapse"
                      start-indent="0pt" border="0.5pt solid black">
              <fo:table-column column-width="55%"/>
              <fo:table-column column-width="30%"/>
              <fo:table-column column-width="15%"/>
              <fo:table-header>
                <fo:table-row background-color="{$table-header-bg}">
                  <fo:table-cell xsl:use-attribute-sets="table-cell">
                    <fo:block font-weight="bold">Data Module Code</fo:block>
                  </fo:table-cell>
                  <fo:table-cell xsl:use-attribute-sets="table-cell">
                    <fo:block font-weight="bold">Title</fo:block>
                  </fo:table-cell>
                  <fo:table-cell xsl:use-attribute-sets="table-cell">
                    <fo:block font-weight="bold">Issue Date</fo:block>
                  </fo:table-cell>
                </fo:table-row>
              </fo:table-header>
              <fo:table-body>
                <xsl:for-each select="$all.dmodules">
                  <fo:table-row keep-together.within-column="always">
                    <fo:table-cell xsl:use-attribute-sets="table-cell">
                      <fo:block font-size="8pt">
                        <xsl:apply-templates select="identAndStatusSection/dmAddress/dmIdent/dmCode"/>
                      </fo:block>
                    </fo:table-cell>
                    <fo:table-cell xsl:use-attribute-sets="table-cell">
                      <fo:block font-size="9pt">
                        <xsl:value-of select="identAndStatusSection/dmAddress/dmAddressItems/dmTitle/techName"/>
                        <xsl:if test="identAndStatusSection/dmAddress/dmAddressItems/dmTitle/infoName">
                          <xsl:text> - </xsl:text>
                          <xsl:value-of select="identAndStatusSection/dmAddress/dmAddressItems/dmTitle/infoName"/>
                        </xsl:if>
                      </fo:block>
                    </fo:table-cell>
                    <fo:table-cell xsl:use-attribute-sets="table-cell">
                      <fo:block font-size="9pt">
                        <xsl:value-of select="identAndStatusSection/dmAddress/dmAddressItems/issueDate/@year"/>
                        <xsl:text>-</xsl:text>
                        <xsl:value-of select="identAndStatusSection/dmAddress/dmAddressItems/issueDate/@month"/>
                        <xsl:text>-</xsl:text>
                        <xsl:value-of select="identAndStatusSection/dmAddress/dmAddressItems/issueDate/@day"/>
                      </fo:block>
                    </fo:table-cell>
                  </fo:table-row>
                </xsl:for-each>
              </fo:table-body>
            </fo:table>
          </fo:block>
          <fo:block>
            <xsl:call-template name="end-of-datamodule-marker"/>
          </fo:block>
        </fo:block>
      </xsl:with-param>
    </xsl:call-template>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--   TABLE OF CONTENTS infoCode 009 (priority 5)                       -->
  <!--   Generates a TOC listing all DMs in the publication.               -->
  <!-- ==================================================================== -->
  <xsl:template match="dmodule[identAndStatusSection/dmAddress/dmIdent/dmCode/@infoCode='009']"
                priority="5">
    <xsl:call-template name="page-sequence">
      <xsl:with-param name="content">
        <fo:block>
          <xsl:call-template name="generate-markers"/>
          <fo:block id="content-start-{generate-id()}">
            <fo:block xsl:use-attribute-sets="centerhead1">Table of Contents</fo:block>
            <fo:block start-indent="{$inner-type-limit}" space-before="10pt">
              <xsl:for-each select="$all.dmodules">
                <fo:block text-align-last="justify" space-after="3pt">
                  <fo:basic-link internal-destination="content-start-{generate-id(.)}" color="blue">
                    <fo:inline>
                      <xsl:value-of select="identAndStatusSection/dmAddress/dmAddressItems/dmTitle/techName"/>
                      <xsl:if test="identAndStatusSection/dmAddress/dmAddressItems/dmTitle/infoName">
                        <xsl:text> - </xsl:text>
                        <xsl:value-of select="identAndStatusSection/dmAddress/dmAddressItems/dmTitle/infoName"/>
                      </xsl:if>
                    </fo:inline>
                  </fo:basic-link>
                  <fo:leader leader-pattern="dots" leader-length.optimum="100%"/>
                  <fo:page-number-citation ref-id="content-start-{generate-id(.)}"/>
                </fo:block>
              </xsl:for-each>
            </fo:block>
          </fo:block>
          <fo:block>
            <xsl:call-template name="end-of-datamodule-marker"/>
          </fo:block>
        </fo:block>
      </xsl:with-param>
    </xsl:call-template>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--   HIGHLIGHTS infoCode 00U (priority 5)                              -->
  <!--   Renders highlight content from the DM's description.              -->
  <!-- ==================================================================== -->
  <xsl:template match="dmodule[identAndStatusSection/dmAddress/dmIdent/dmCode/@infoCode='00U']"
                priority="5">
    <xsl:call-template name="page-sequence">
      <xsl:with-param name="content">
        <fo:block>
          <xsl:call-template name="generate-markers"/>
          <fo:block id="content-start-{generate-id()}">
            <fo:block xsl:use-attribute-sets="centerhead1">Highlights</fo:block>
            <xsl:choose>
              <xsl:when test="content/description/levelledPara or content/description/para">
                <xsl:apply-templates select="content/description"/>
              </xsl:when>
              <xsl:otherwise>
                <fo:block start-indent="{$inner-type-limit}" space-before="10pt">
                  <fo:block font-style="italic">No highlights for this issue.</fo:block>
                </fo:block>
              </xsl:otherwise>
            </xsl:choose>
          </fo:block>
          <fo:block>
            <xsl:call-template name="end-of-datamodule-marker"/>
          </fo:block>
        </fo:block>
      </xsl:with-param>
    </xsl:call-template>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--   LIST OF ABBREVIATIONS infoCode 005 (priority 5)                   -->
  <!--   Renders abbreviation content from the DM description.             -->
  <!-- ==================================================================== -->
  <xsl:template match="dmodule[identAndStatusSection/dmAddress/dmIdent/dmCode/@infoCode='005']"
                priority="5">
    <xsl:call-template name="page-sequence">
      <xsl:with-param name="content">
        <fo:block>
          <xsl:call-template name="generate-markers"/>
          <fo:block id="content-start-{generate-id()}">
            <fo:block xsl:use-attribute-sets="centerhead1">
              <xsl:value-of select="identAndStatusSection/dmAddress/dmAddressItems/dmTitle/techName"/>
              <xsl:if test="identAndStatusSection/dmAddress/dmAddressItems/dmTitle/infoName">
                <xsl:text> - </xsl:text>
                <xsl:value-of select="identAndStatusSection/dmAddress/dmAddressItems/dmTitle/infoName"/>
              </xsl:if>
            </fo:block>
            <xsl:apply-templates select="content"/>
          </fo:block>
          <fo:block>
            <xsl:call-template name="end-of-datamodule-marker"/>
          </fo:block>
        </fo:block>
      </xsl:with-param>
    </xsl:call-template>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--   HIGHLIGHTS element template (for inline use)                      -->
  <!-- ==================================================================== -->
  <xsl:template match="highlights">
    <fo:block id="{generate-id()}" break-before="page">
      <fo:block xsl:use-attribute-sets="centerhead1">Highlights</fo:block>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--   DM STATUS (only rendered when show.dm.status != 0)                -->
  <!-- ==================================================================== -->
  <xsl:template match="dmStatus" priority="2">
    <xsl:if test="$show.dm.status != 0">
      <fo:block padding-top="{$standard-leading}">
        <xsl:apply-templates select="security" mode="status-block"/>
        <xsl:apply-templates select="responsiblePartnerCompany" mode="status-block"/>
        <xsl:apply-templates select="originator" mode="status-block"/>
        <xsl:apply-templates select="applic" mode="status-block"/>
        <xsl:apply-templates select="brexDmRef" mode="status-block"/>
        <xsl:apply-templates select="qualityAssurance" mode="status-block"/>
        <xsl:apply-templates select="reasonForUpdate" mode="status-block"/>
      </fo:block>
    </xsl:if>
  </xsl:template>

  <xsl:template match="security" mode="status-block">
    <fo:block padding-top="3pt">
      <fo:inline font-weight="bold">Security Classification: </fo:inline>
      <xsl:choose>
        <xsl:when test="@securityClassification = '01'">Unclassified</xsl:when>
        <xsl:when test="@securityClassification = '02'">Restricted</xsl:when>
        <xsl:when test="@securityClassification = '03'">Confidential</xsl:when>
        <xsl:when test="@securityClassification = '04'">Secret</xsl:when>
        <xsl:when test="@securityClassification = '05'">Top Secret</xsl:when>
        <xsl:otherwise><xsl:value-of select="@securityClassification"/></xsl:otherwise>
      </xsl:choose>
    </fo:block>
  </xsl:template>

  <xsl:template match="responsiblePartnerCompany" mode="status-block">
    <fo:block padding-top="3pt">
      <fo:inline font-weight="bold">Responsible Partner: </fo:inline>
      <xsl:value-of select="enterpriseName"/>
    </fo:block>
  </xsl:template>

  <xsl:template match="originator" mode="status-block">
    <fo:block padding-top="3pt">
      <fo:inline font-weight="bold">Originator: </fo:inline>
      <xsl:value-of select="enterpriseName"/>
    </fo:block>
  </xsl:template>

  <xsl:template match="applic" mode="status-block">
    <fo:block padding-top="3pt">
      <fo:inline font-weight="bold">Applicability: </fo:inline>
      <xsl:value-of select="displayText/simplePara"/>
    </fo:block>
  </xsl:template>

  <xsl:template match="brexDmRef" mode="status-block">
    <fo:block padding-top="3pt">
      <fo:inline font-weight="bold">BREX: </fo:inline>
      <xsl:apply-templates select="dmRef"/>
    </fo:block>
  </xsl:template>

  <xsl:template match="qualityAssurance" mode="status-block">
    <fo:block padding-top="3pt">
      <fo:inline font-weight="bold">Quality Assurance: </fo:inline>
      <xsl:choose>
        <xsl:when test="unverified">Unverified</xsl:when>
        <xsl:when test="firstVerification">First Verification</xsl:when>
        <xsl:when test="secondVerification">Second Verification</xsl:when>
      </xsl:choose>
    </fo:block>
  </xsl:template>

  <xsl:template match="reasonForUpdate" mode="status-block">
    <fo:block padding-top="3pt">
      <fo:inline font-weight="bold">Reason for Update: </fo:inline>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--   DATA RESTRICTIONS (frontmatter copyright blocks)                   -->
  <!-- ==================================================================== -->
  <xsl:template match="dataRestrictions">
    <fo:block padding-top="3pt" border="0.5pt solid black"
              padding="3mm" margin-left="0mm" margin-right="0mm" background-color="#fff0f0">
      <fo:block font-weight="bold">Data Restrictions</fo:block>
      <xsl:apply-templates/>
    </fo:block>
  </xsl:template>

  <xsl:template match="restrictionInfo">
    <fo:block padding-top="3pt"><xsl:apply-templates/></fo:block>
  </xsl:template>

  <xsl:template match="restrictionInstructions">
    <fo:block padding-top="3pt"><xsl:apply-templates/></fo:block>
  </xsl:template>

  <xsl:template match="copyright">
    <fo:block padding-top="3pt"><xsl:apply-templates/></fo:block>
  </xsl:template>

  <xsl:template match="copyrightPara">
    <fo:block padding-top="2pt"><xsl:apply-templates/></fo:block>
  </xsl:template>

  <xsl:template match="dataDistribution|exportControl|exportRegistrationStmt|
                       dataHandling|dataDestruction|dataDisclosure">
    <fo:block padding-top="2pt"><xsl:apply-templates/></fo:block>
  </xsl:template>

  <xsl:template match="policyStatement|dataConds">
    <fo:block padding-top="2pt" font-style="italic"><xsl:apply-templates/></fo:block>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--   RECORD OF REVISIONS (named template, called optionally)           -->
  <!-- ==================================================================== -->
  <xsl:template name="record-of-revisions">
    <xsl:if test="$generate.record.of.revisions != 0">
      <fo:block break-before="page">
        <fo:block xsl:use-attribute-sets="centerhead1">Record of Revisions</fo:block>
        <fo:table table-layout="fixed" width="100%" border-collapse="collapse" start-indent="0pt">
          <fo:table-column column-width="20%"/>
          <fo:table-column column-width="20%"/>
          <fo:table-column column-width="40%"/>
          <fo:table-column column-width="20%"/>
          <fo:table-header>
            <fo:table-row background-color="{$table-header-bg}">
              <fo:table-cell xsl:use-attribute-sets="table-cell">
                <fo:block font-weight="bold">Revision</fo:block>
              </fo:table-cell>
              <fo:table-cell xsl:use-attribute-sets="table-cell">
                <fo:block font-weight="bold">Date</fo:block>
              </fo:table-cell>
              <fo:table-cell xsl:use-attribute-sets="table-cell">
                <fo:block font-weight="bold">Description</fo:block>
              </fo:table-cell>
              <fo:table-cell xsl:use-attribute-sets="table-cell">
                <fo:block font-weight="bold">By</fo:block>
              </fo:table-cell>
            </fo:table-row>
          </fo:table-header>
          <fo:table-body>
            <fo:table-row>
              <fo:table-cell xsl:use-attribute-sets="table-cell">
                <fo:block>
                  <xsl:value-of select="//identAndStatusSection/dmAddress/dmIdent/issueInfo/@issueNumber"/>
                  <xsl:text>-</xsl:text>
                  <xsl:value-of select="//identAndStatusSection/dmAddress/dmIdent/issueInfo/@inWork"/>
                </fo:block>
              </fo:table-cell>
              <fo:table-cell xsl:use-attribute-sets="table-cell">
                <fo:block>
                  <xsl:value-of select="//identAndStatusSection/dmAddress/dmAddressItems/issueDate/@year"/>
                  <xsl:text>-</xsl:text>
                  <xsl:value-of select="//identAndStatusSection/dmAddress/dmAddressItems/issueDate/@month"/>
                  <xsl:text>-</xsl:text>
                  <xsl:value-of select="//identAndStatusSection/dmAddress/dmAddressItems/issueDate/@day"/>
                </fo:block>
              </fo:table-cell>
              <fo:table-cell xsl:use-attribute-sets="table-cell">
                <fo:block>
                  <xsl:value-of select="//identAndStatusSection/dmStatus/reasonForUpdate/simplePara"/>
                </fo:block>
              </fo:table-cell>
              <fo:table-cell xsl:use-attribute-sets="table-cell">
                <fo:block>
                  <xsl:value-of select="//identAndStatusSection/dmStatus/originator/enterpriseName"/>
                </fo:block>
              </fo:table-cell>
            </fo:table-row>
          </fo:table-body>
        </fo:table>
      </fo:block>
    </xsl:if>
  </xsl:template>

</xsl:stylesheet>