<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     S1000D to XSL-FO: Requirements Module
     
     Contains templates for preliminary requirements tables
     (conditions, support equipment, supplies, spares, safety).
     ******************************************************************** -->

<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
  xmlns:fo="http://www.w3.org/1999/XSL/Format">

  <!-- ==================================================================== -->
  <!--                    PRELIMINARY REQUIREMENTS                           -->
  <!-- ==================================================================== -->
  <xsl:template match="preliminaryRqmts">
    <fo:block id="{generate-id()}">
      <fo:block xsl:use-attribute-sets="centerhead2">Preliminary requirements</fo:block>
      <xsl:choose>
        <xsl:when test="$hide.empty.proced.rqmts = 0">
          <xsl:apply-templates select="productionMaintData"/>
          <xsl:apply-templates select="reqCondGroup"/>
          <xsl:apply-templates select="reqPersons"/>
          <xsl:apply-templates select="reqTechInfoGroup"/>
          <xsl:apply-templates select="reqSupportEquips"/>
          <xsl:apply-templates select="reqSupplies"/>
          <xsl:apply-templates select="reqSpares"/>
          <xsl:apply-templates select="reqSafety"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:apply-templates select="productionMaintData"/>
          <xsl:apply-templates select="reqCondGroup[not(noConds)]"/>
          <xsl:apply-templates select="reqPersons"/>
          <xsl:apply-templates select="reqTechInfoGroup[not(noReqTechInfo)]"/>
          <xsl:apply-templates select="reqSupportEquips[not(noSupportEquips)]"/>
          <xsl:apply-templates select="reqSupplies[not(noSupplies)]"/>
          <xsl:apply-templates select="reqSpares[not(noSpares)]"/>
          <xsl:apply-templates select="reqSafety[not(noSafety)]"/>
        </xsl:otherwise>
      </xsl:choose>
    </fo:block>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    REQUIRED CONDITIONS                                -->
  <!-- ==================================================================== -->
  <xsl:template match="reqCondGroup">
    <fo:block id="{generate-id()}">
      <fo:block xsl:use-attribute-sets="sidehead0">Required conditions</fo:block>
      <fo:block padding-top="{$standard-leading}">
        <fo:block font-style="italic" text-align="center" space-after="6pt">
          <xsl:apply-templates select="." mode="label"/>
          <xsl:text>  </xsl:text>
          <xsl:apply-templates select="." mode="title"/>
        </fo:block>
        <fo:table xsl:use-attribute-sets="table" start-indent="0pt" end-indent="0pt">
          <fo:table-column column-width="proportional-column-width(1)"/>
          <fo:table-column column-width="proportional-column-width(1)"/>
          <fo:table-header font-weight="bold">
            <fo:table-row>
              <fo:table-cell xsl:use-attribute-sets="header-cell">
                <fo:block>Action/Condition</fo:block>
              </fo:table-cell>
              <fo:table-cell xsl:use-attribute-sets="header-cell">
                <fo:block>Data module/Technical publication</fo:block>
              </fo:table-cell>
            </fo:table-row>
          </fo:table-header>
          <fo:table-body>
            <xsl:choose>
              <xsl:when test="noConds">
                <fo:table-row>
                  <fo:table-cell xsl:use-attribute-sets="body-cell">
                    <fo:block>None</fo:block>
                  </fo:table-cell>
                  <fo:table-cell xsl:use-attribute-sets="body-cell">
                    <fo:block/>
                  </fo:table-cell>
                </fo:table-row>
              </xsl:when>
              <xsl:otherwise>
                <xsl:apply-templates select="reqCondNoRef|reqCondDm|reqCondExternalPub"/>
              </xsl:otherwise>
            </xsl:choose>
          </fo:table-body>
        </fo:table>
      </fo:block>
    </fo:block>
  </xsl:template>

  <xsl:template match="reqCondNoRef">
    <fo:table-row>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block>
          <xsl:apply-templates select="reqCond"/>
        </fo:block>
      </fo:table-cell>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block/>
      </fo:table-cell>
    </fo:table-row>
  </xsl:template>

  <xsl:template match="reqCondDm">
    <fo:table-row>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block>
          <xsl:apply-templates select="reqCond"/>
        </fo:block>
      </fo:table-cell>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block>
          <xsl:apply-templates select="dmRef"/>
        </fo:block>
      </fo:table-cell>
    </fo:table-row>
  </xsl:template>

  <xsl:template match="reqCondExternalPub">
    <fo:table-row>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block>
          <xsl:apply-templates select="reqCond"/>
        </fo:block>
      </fo:table-cell>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block>
          <xsl:apply-templates select="externalPubRef"/>
        </fo:block>
      </fo:table-cell>
    </fo:table-row>
  </xsl:template>

  <xsl:template match="reqCond">
    <xsl:apply-templates/>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    REQUIRED PERSONS                                   -->
  <!-- ==================================================================== -->
  <xsl:template match="reqPersons">
    <fo:block>
      <fo:block xsl:use-attribute-sets="sidehead0">Required persons</fo:block>
      <fo:block padding-top="{$standard-leading}">
        <fo:table xsl:use-attribute-sets="table">
          <fo:table-column column-width="proportional-column-width(1)"/>
          <fo:table-column column-width="proportional-column-width(1)"/>
          <fo:table-column column-width="proportional-column-width(1)"/>
          <fo:table-column column-width="proportional-column-width(1)"/>
          <fo:table-column column-width="proportional-column-width(1)"/>
          <fo:table-header font-weight="bold">
            <fo:table-row>
              <fo:table-cell xsl:use-attribute-sets="header-cell"><fo:block>Person</fo:block></fo:table-cell>
              <fo:table-cell xsl:use-attribute-sets="header-cell"><fo:block>Category</fo:block></fo:table-cell>
              <fo:table-cell xsl:use-attribute-sets="header-cell"><fo:block>Skill Level</fo:block></fo:table-cell>
              <fo:table-cell xsl:use-attribute-sets="header-cell"><fo:block>Trade</fo:block></fo:table-cell>
              <fo:table-cell xsl:use-attribute-sets="header-cell"><fo:block>Est. Time</fo:block></fo:table-cell>
            </fo:table-row>
          </fo:table-header>
          <fo:table-body>
            <xsl:choose>
              <xsl:when test="person|personnel">
                <xsl:apply-templates select="person|personnel"/>
              </xsl:when>
              <xsl:otherwise>
                <fo:table-row>
                  <fo:table-cell xsl:use-attribute-sets="body-cell">
                    <fo:block>As required</fo:block>
                  </fo:table-cell>
                  <fo:table-cell xsl:use-attribute-sets="body-cell"><fo:block/></fo:table-cell>
                  <fo:table-cell xsl:use-attribute-sets="body-cell"><fo:block/></fo:table-cell>
                  <fo:table-cell xsl:use-attribute-sets="body-cell"><fo:block/></fo:table-cell>
                  <fo:table-cell xsl:use-attribute-sets="body-cell"><fo:block/></fo:table-cell>
                </fo:table-row>
              </xsl:otherwise>
            </xsl:choose>
          </fo:table-body>
        </fo:table>
      </fo:block>
    </fo:block>
  </xsl:template>

  <xsl:template match="person">
    <fo:table-row>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block>Man <xsl:value-of select="@man"/></fo:block>
      </fo:table-cell>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block><xsl:value-of select="personCategory/@personCategoryCode"/></fo:block>
      </fo:table-cell>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block><xsl:value-of select="personSkill/@skillLevelCode"/></fo:block>
      </fo:table-cell>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block><xsl:value-of select="trade"/></fo:block>
      </fo:table-cell>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block><xsl:apply-templates select="estimatedTime"/></fo:block>
      </fo:table-cell>
    </fo:table-row>
  </xsl:template>

  <xsl:template match="personnel">
    <fo:table-row>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block>As required</fo:block>
      </fo:table-cell>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block><xsl:value-of select="personCategory/@personCategoryCode"/></fo:block>
      </fo:table-cell>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block><xsl:value-of select="personSkill/@skillLevelCode"/></fo:block>
      </fo:table-cell>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block><xsl:value-of select="trade"/></fo:block>
      </fo:table-cell>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block><xsl:apply-templates select="estimatedTime"/></fo:block>
      </fo:table-cell>
    </fo:table-row>
  </xsl:template>

  <xsl:template match="estimatedTime">
    <xsl:apply-templates/>
    <xsl:if test="@unitOfMeasure">
      <xsl:text> </xsl:text>
      <xsl:value-of select="@unitOfMeasure"/>
    </xsl:if>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    REQUIRED TECHNICAL INFORMATION                     -->
  <!-- ==================================================================== -->
  <xsl:template match="reqTechInfoGroup">
    <fo:block>
      <fo:block xsl:use-attribute-sets="sidehead0">Required technical information</fo:block>
      <fo:block padding-top="{$standard-leading}">
        <fo:table xsl:use-attribute-sets="table">
          <fo:table-column column-width="proportional-column-width(1)"/>
          <fo:table-column column-width="proportional-column-width(1)"/>
          <fo:table-header font-weight="bold">
            <fo:table-row>
              <fo:table-cell xsl:use-attribute-sets="header-cell"><fo:block>Technical information</fo:block></fo:table-cell>
              <fo:table-cell xsl:use-attribute-sets="header-cell"><fo:block>Data module/Technical publication</fo:block></fo:table-cell>
            </fo:table-row>
          </fo:table-header>
          <fo:table-body>
            <xsl:choose>
              <xsl:when test="noReqTechInfo">
                <fo:table-row>
                  <fo:table-cell xsl:use-attribute-sets="body-cell">
                    <fo:block>None</fo:block>
                  </fo:table-cell>
                  <fo:table-cell xsl:use-attribute-sets="body-cell">
                    <fo:block/>
                  </fo:table-cell>
                </fo:table-row>
              </xsl:when>
              <xsl:otherwise>
                <xsl:apply-templates select="reqTechInfo"/>
              </xsl:otherwise>
            </xsl:choose>
          </fo:table-body>
        </fo:table>
      </fo:block>
    </fo:block>
  </xsl:template>

  <xsl:template match="reqTechInfo">
    <fo:table-row>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block>
          <xsl:apply-templates select="reqTechInfoRef"/>
        </fo:block>
      </fo:table-cell>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block>
          <xsl:apply-templates select="dmRef|pmRef|externalPubRef"/>
        </fo:block>
      </fo:table-cell>
    </fo:table-row>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    SUPPORT EQUIPMENT                                  -->
  <!-- ==================================================================== -->
  <xsl:template match="reqSupportEquips">
    <fo:block id="{generate-id()}">
      <fo:block xsl:use-attribute-sets="sidehead0">Support equipment</fo:block>
      <fo:block padding-top="{$standard-leading}">
        <fo:block font-style="italic" text-align="center" space-after="6pt">
          <xsl:apply-templates select="." mode="label"/>
          <xsl:text>  </xsl:text>
          <xsl:apply-templates select="." mode="title"/>
        </fo:block>
        <fo:table xsl:use-attribute-sets="table" start-indent="0pt" end-indent="0pt">
          <fo:table-column column-width="proportional-column-width(2)"/>
          <fo:table-column column-width="proportional-column-width(2)"/>
          <fo:table-column column-width="proportional-column-width(1)"/>
          <fo:table-column column-width="proportional-column-width(2)"/>
          <fo:table-header font-weight="bold">
            <fo:table-row>
              <fo:table-cell xsl:use-attribute-sets="header-cell"><fo:block>Name/Alternate name</fo:block></fo:table-cell>
              <fo:table-cell xsl:use-attribute-sets="header-cell"><fo:block>Identification/Reference</fo:block></fo:table-cell>
              <fo:table-cell xsl:use-attribute-sets="header-cell"><fo:block>Quantity</fo:block></fo:table-cell>
              <fo:table-cell xsl:use-attribute-sets="header-cell"><fo:block>Remark</fo:block></fo:table-cell>
            </fo:table-row>
          </fo:table-header>
          <fo:table-body>
            <xsl:choose>
              <xsl:when test="noSupportEquips">
                <fo:table-row>
                  <fo:table-cell xsl:use-attribute-sets="body-cell"><fo:block>None</fo:block></fo:table-cell>
                  <fo:table-cell xsl:use-attribute-sets="body-cell"><fo:block/></fo:table-cell>
                  <fo:table-cell xsl:use-attribute-sets="body-cell"><fo:block/></fo:table-cell>
                  <fo:table-cell xsl:use-attribute-sets="body-cell"><fo:block/></fo:table-cell>
                </fo:table-row>
              </xsl:when>
              <xsl:otherwise>
                <xsl:apply-templates select="supportEquipDescrGroup/supportEquipDescr"/>
              </xsl:otherwise>
            </xsl:choose>
          </fo:table-body>
        </fo:table>
      </fo:block>
    </fo:block>
  </xsl:template>

  <xsl:template match="supportEquipDescr">
    <fo:table-row>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <xsl:if test="@id">
          <xsl:attribute name="id">
            <xsl:call-template name="generate-link-id">
              <xsl:with-param name="localId" select="@id"/>
            </xsl:call-template>
          </xsl:attribute>
        </xsl:if>
        <fo:block><xsl:value-of select="name"/></fo:block>
      </fo:table-cell>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block><xsl:apply-templates select="identNumber|toolRef|catalogSeqNumberRef"/></fo:block>
      </fo:table-cell>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block><xsl:apply-templates select="reqQuantity"/></fo:block>
      </fo:table-cell>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block><xsl:apply-templates select="remarks"/></fo:block>
      </fo:table-cell>
    </fo:table-row>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    SUPPLIES                                           -->
  <!-- ==================================================================== -->
  <xsl:template match="reqSupplies">
    <fo:block id="{generate-id()}">
      <fo:block xsl:use-attribute-sets="sidehead0">Consumables, materials and expendables</fo:block>
      <fo:block padding-top="{$standard-leading}">
        <fo:block font-style="italic" text-align="center" space-after="6pt">
          <xsl:apply-templates select="." mode="label"/>
          <xsl:text>  </xsl:text>
          <xsl:apply-templates select="." mode="title"/>
        </fo:block>
        <fo:table xsl:use-attribute-sets="table" start-indent="0pt" end-indent="0pt">
          <fo:table-column column-width="proportional-column-width(2)"/>
          <fo:table-column column-width="proportional-column-width(2)"/>
          <fo:table-column column-width="proportional-column-width(1)"/>
          <fo:table-column column-width="proportional-column-width(2)"/>
          <fo:table-header font-weight="bold">
            <fo:table-row>
              <fo:table-cell xsl:use-attribute-sets="header-cell"><fo:block>Name/Alternate name</fo:block></fo:table-cell>
              <fo:table-cell xsl:use-attribute-sets="header-cell"><fo:block>Identification/Reference</fo:block></fo:table-cell>
              <fo:table-cell xsl:use-attribute-sets="header-cell"><fo:block>Quantity</fo:block></fo:table-cell>
              <fo:table-cell xsl:use-attribute-sets="header-cell"><fo:block>Remark</fo:block></fo:table-cell>
            </fo:table-row>
          </fo:table-header>
          <fo:table-body>
            <xsl:choose>
              <xsl:when test="noSupplies">
                <fo:table-row>
                  <fo:table-cell xsl:use-attribute-sets="body-cell"><fo:block>None</fo:block></fo:table-cell>
                  <fo:table-cell xsl:use-attribute-sets="body-cell"><fo:block/></fo:table-cell>
                  <fo:table-cell xsl:use-attribute-sets="body-cell"><fo:block/></fo:table-cell>
                  <fo:table-cell xsl:use-attribute-sets="body-cell"><fo:block/></fo:table-cell>
                </fo:table-row>
              </xsl:when>
              <xsl:otherwise>
                <xsl:apply-templates select="supplyDescrGroup/supplyDescr"/>
              </xsl:otherwise>
            </xsl:choose>
          </fo:table-body>
        </fo:table>
      </fo:block>
    </fo:block>
  </xsl:template>

  <xsl:template match="supplyDescr">
    <fo:table-row>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <xsl:if test="@id">
          <xsl:attribute name="id">
            <xsl:call-template name="generate-link-id">
              <xsl:with-param name="localId" select="@id"/>
            </xsl:call-template>
          </xsl:attribute>
        </xsl:if>
        <fo:block><xsl:value-of select="name"/></fo:block>
      </fo:table-cell>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block><xsl:apply-templates select="identNumber|supplyRef|catalogSeqNumberRef"/></fo:block>
      </fo:table-cell>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block><xsl:apply-templates select="reqQuantity"/></fo:block>
      </fo:table-cell>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block><xsl:apply-templates select="remarks"/></fo:block>
      </fo:table-cell>
    </fo:table-row>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    SPARES                                             -->
  <!-- ==================================================================== -->
  <xsl:template match="reqSpares">
    <fo:block id="{generate-id()}">
      <fo:block xsl:use-attribute-sets="sidehead0">Spares</fo:block>
      <fo:block padding-top="{$standard-leading}">
        <fo:block font-style="italic" text-align="center" space-after="6pt">
          <xsl:apply-templates select="." mode="label"/>
          <xsl:text>  </xsl:text>
          <xsl:apply-templates select="." mode="title"/>
        </fo:block>
        <fo:table xsl:use-attribute-sets="table" start-indent="0pt" end-indent="0pt">
          <fo:table-column column-width="proportional-column-width(2)"/>
          <fo:table-column column-width="proportional-column-width(2)"/>
          <fo:table-column column-width="proportional-column-width(1)"/>
          <fo:table-column column-width="proportional-column-width(2)"/>
          <fo:table-header font-weight="bold">
            <fo:table-row>
              <fo:table-cell xsl:use-attribute-sets="header-cell"><fo:block>Name/Alternate name</fo:block></fo:table-cell>
              <fo:table-cell xsl:use-attribute-sets="header-cell"><fo:block>Identification/Reference</fo:block></fo:table-cell>
              <fo:table-cell xsl:use-attribute-sets="header-cell"><fo:block>Quantity</fo:block></fo:table-cell>
              <fo:table-cell xsl:use-attribute-sets="header-cell"><fo:block>Remark</fo:block></fo:table-cell>
            </fo:table-row>
          </fo:table-header>
          <fo:table-body>
            <xsl:choose>
              <xsl:when test="noSpares">
                <fo:table-row>
                  <fo:table-cell xsl:use-attribute-sets="body-cell"><fo:block>None</fo:block></fo:table-cell>
                  <fo:table-cell xsl:use-attribute-sets="body-cell"><fo:block/></fo:table-cell>
                  <fo:table-cell xsl:use-attribute-sets="body-cell"><fo:block/></fo:table-cell>
                  <fo:table-cell xsl:use-attribute-sets="body-cell"><fo:block/></fo:table-cell>
                </fo:table-row>
              </xsl:when>
              <xsl:otherwise>
                <xsl:apply-templates select="spareDescrGroup/spareDescr"/>
              </xsl:otherwise>
            </xsl:choose>
          </fo:table-body>
        </fo:table>
      </fo:block>
    </fo:block>
  </xsl:template>

  <xsl:template match="spareDescr">
    <fo:table-row>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <xsl:if test="@id">
          <xsl:attribute name="id">
            <xsl:call-template name="generate-link-id">
              <xsl:with-param name="localId" select="@id"/>
            </xsl:call-template>
          </xsl:attribute>
        </xsl:if>
        <fo:block><xsl:value-of select="name"/></fo:block>
      </fo:table-cell>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block><xsl:apply-templates select="identNumber|partRef|catalogSeqNumberRef"/></fo:block>
      </fo:table-cell>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block><xsl:apply-templates select="reqQuantity"/></fo:block>
      </fo:table-cell>
      <fo:table-cell xsl:use-attribute-sets="body-cell">
        <fo:block><xsl:apply-templates select="remarks"/></fo:block>
      </fo:table-cell>
    </fo:table-row>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    SAFETY                                             -->
  <!-- ==================================================================== -->
  <xsl:template match="reqSafety">
    <fo:block>
      <fo:block xsl:use-attribute-sets="sidehead0">Safety conditions</fo:block>
      <xsl:choose>
        <xsl:when test="noSafety">
          <fo:block padding-top="{$standard-leading}">None</fo:block>
        </xsl:when>
        <xsl:otherwise>
          <xsl:apply-templates select="safetyRqmts"/>
        </xsl:otherwise>
      </xsl:choose>
    </fo:block>
  </xsl:template>

  <xsl:template match="safetyRqmts">
    <xsl:apply-templates/>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    CLOSE REQUIREMENTS                                 -->
  <!-- ==================================================================== -->
  <xsl:template match="closeRqmts">
    <fo:block id="{generate-id()}">
      <fo:block xsl:use-attribute-sets="centerhead2">Requirements after job completion</fo:block>
      <xsl:apply-templates select="reqCondGroup"/>
    </fo:block>
  </xsl:template>

  <!-- ==================================================================== -->
  <!--                    NUMBERING AND TITLES                               -->
  <!-- ==================================================================== -->
  <xsl:template match="reqCondGroup|reqSupportEquips|reqSupplies|reqSpares" mode="number">
    <xsl:number count="content|reqCondGroup|reqSupportEquips|reqSupplies|reqSpares|table" 
        level="any" from="dmodule"/>
  </xsl:template>

  <xsl:template match="reqCondGroup|reqSupportEquips|reqSupplies|reqSpares" mode="label">
    <xsl:text>Table </xsl:text>
    <xsl:apply-templates select="." mode="number"/>
  </xsl:template>

  <xsl:template match="reqCondGroup" mode="title">Required conditions</xsl:template>
  <xsl:template match="reqSupportEquips" mode="title">Support equipment</xsl:template>
  <xsl:template match="reqSupplies" mode="title">Consumables, materials and expendables</xsl:template>
  <xsl:template match="reqSpares" mode="title">Spares</xsl:template>

  <!-- Label modes for internal references -->
  <xsl:template match="supportEquipDescr|supplyDescr|spareDescr" mode="label">
    <xsl:choose>
      <xsl:when test="shortName">
        <xsl:apply-templates select="shortName"/>
      </xsl:when>
      <xsl:when test="name">
        <xsl:apply-templates select="name"/>
      </xsl:when>
      <xsl:otherwise>
        <xsl:apply-templates select="identNumber"/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

</xsl:stylesheet>
